<?php

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $secretKey = "6LdXYWosAAAAAHAhlMg2MhUMfh7LZ3sAYyBQlMka";
    $recaptchaResponse = $_POST['g-recaptcha-response'];

    // Verificar con Google usando cURL (más fiable que file_get_contents)
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://www.google.com/recaptcha/api/siteverify");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'secret' => $secretKey,
        'response' => $recaptchaResponse
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $verify = curl_exec($ch);
    curl_close($ch);

    $captchaSuccess = json_decode($verify);

    if ($captchaSuccess->success) {

        // Sanitizar datos
        $nombre = htmlspecialchars($_POST['nombre']);
        $email = filter_var($_POST['email'], FILTER_SANITIZE_EMAIL);
        $mensaje = htmlspecialchars($_POST['mensaje']);

        // Validar email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            die("Email no válido");
        }

        // Enviar email SOLO si captcha es válido
        $to = "oscarpadillaarcas@gmail.com";
        $subject = "Nuevo mensaje desde tu web";
        $body = "Nombre: $nombre\nEmail: $email\nMensaje:\n$mensaje";
        $headers = "From: $email";

        if (mail($to, $subject, $body, $headers)) {
            echo "Mensaje enviado correctamente ✅";
        } else {
            echo "Error al enviar el mensaje.";
        }

    } else {
        echo "Error: Verifica que no eres un robot ❌";
    }
}
?>
