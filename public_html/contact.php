<?php
/**
 * Baresic Advisory — contact form handler.
 * Sends enquiries (with optional CV attachment) to the address below using PHP mail().
 * Works on standard cPanel hosting. Returns JSON for AJAX requests, otherwise redirects.
 */

// ---- Settings --------------------------------------------------------------
$TO_EMAIL   = 'tonio@baresicadvisory.com';
$FROM_EMAIL = 'noreply@baresicadvisory.com';   // must be on this domain for good deliverability
$FROM_NAME  = 'Baresic Advisory Website';
$MAX_FILE   = 5 * 1024 * 1024;                 // 5MB
$ALLOWED    = ['pdf' => 'application/pdf', 'doc' => 'application/msword',
               'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
// ---------------------------------------------------------------------------

$isAjax = (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
       || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

function respond($ok, $message = '') {
    global $isAjax;
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message]);
    } else {
        $q = $ok ? 'sent=1' : 'sent=0&msg=' . rawurlencode($message);
        header('Location: /?' . $q . '#contact', true, 303);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /', true, 303);
    exit;
}

// Honeypot — bots fill this in. Pretend success.
if (!empty($_POST['website'])) {
    respond(true);
}

function clean_line($v, $max) {
    $v = trim((string)($v ?? ''));
    $v = preg_replace('/[\r\n\t]+/', ' ', $v);   // prevent header injection
    return mb_substr($v, 0, $max);
}

$type    = clean_line($_POST['enquiry_type'] ?? '', 20);
$type    = in_array($type, ['Company', 'Candidate'], true) ? $type : 'Company';
$name    = clean_line($_POST['name'] ?? '', 120);
$email   = clean_line($_POST['email'] ?? '', 200);
$phone   = clean_line($_POST['phone'] ?? '', 40);
$company = clean_line($_POST['company'] ?? '', 160);
$role    = clean_line($_POST['role'] ?? '', 160);
$message = trim(mb_substr((string)($_POST['message'] ?? ''), 0, 5000));
$consent = ($_POST['consent'] ?? '') === 'yes';

if ($name === '' || $message === '') {
    respond(false, 'Please complete all required fields.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please enter a valid email address.');
}
if (!$consent) {
    respond(false, 'Please confirm your consent so we can respond to your enquiry.');
}

// ---- Optional CV attachment ------------------------------------------------
$attachment = null;
if ($type === 'Candidate' && isset($_FILES['cv']) && $_FILES['cv']['error'] !== UPLOAD_ERR_NO_FILE) {
    $f = $_FILES['cv'];
    if ($f['error'] !== UPLOAD_ERR_OK) {
        respond(false, 'Your CV could not be uploaded. Please try again or email it directly.');
    }
    if ($f['size'] > $MAX_FILE) {
        respond(false, 'Your CV must be 5MB or smaller.');
    }
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!isset($ALLOWED[$ext]) || !is_uploaded_file($f['tmp_name'])) {
        respond(false, 'Please attach your CV as a PDF, DOC or DOCX file.');
    }
    $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', basename($f['name']));
    $attachment = [
        'name' => $safeName ?: ('cv.' . $ext),
        'type' => $ALLOWED[$ext],
        'data' => file_get_contents($f['tmp_name']),
    ];
}

// ---- Build email ------------------------------------------------------------
$subject = 'Website enquiry (' . $type . '): ' . $name;
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$lines = [
    'New enquiry from baresicadvisory.com',
    str_repeat('-', 40),
    'Enquiry type: ' . $type,
    'Name:         ' . $name,
    'Email:        ' . $email,
    'Phone:        ' . ($phone !== '' ? $phone : '-'),
];
if ($type === 'Company') {
    $lines[] = 'Organisation: ' . ($company !== '' ? $company : '-');
} else {
    $lines[] = 'Role sought:  ' . ($role !== '' ? $role : '-');
    $lines[] = 'CV attached:  ' . ($attachment ? 'Yes (' . $attachment['name'] . ')' : 'No');
}
$lines[] = str_repeat('-', 40);
$lines[] = '';
$lines[] = $message;
$lines[] = '';
$lines[] = str_repeat('-', 40);
$lines[] = 'Sent: ' . date('j M Y, g:i a T') . ' | IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$text = implode("\r\n", $lines);

$headers   = [];
$headers[] = 'From: ' . '=?UTF-8?B?' . base64_encode($FROM_NAME) . '?=' . ' <' . $FROM_EMAIL . '>';
$headers[] = 'Reply-To: ' . '=?UTF-8?B?' . base64_encode($name) . '?=' . ' <' . $email . '>';
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'X-Mailer: PHP/' . phpversion();

if ($attachment) {
    $boundary = 'b_' . bin2hex(random_bytes(12));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $body  = '--' . $boundary . "\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($text)) . "\r\n";
    $body .= '--' . $boundary . "\r\n";
    $body .= 'Content-Type: ' . $attachment['type'] . '; name="' . $attachment['name'] . "\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= 'Content-Disposition: attachment; filename="' . $attachment['name'] . "\"\r\n\r\n";
    $body .= chunk_split(base64_encode($attachment['data'])) . "\r\n";
    $body .= '--' . $boundary . "--\r\n";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($text));
}

$sent = @mail($TO_EMAIL, $encodedSubject, $body, implode("\r\n", $headers), '-f' . $FROM_EMAIL);

if ($sent) {
    respond(true);
}
respond(false, 'Sorry, your enquiry could not be sent. Please email tonio@baresicadvisory.com directly.');
