<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>{{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background:#090707;font-family:Arial,Helvetica,sans-serif;color:#fff8f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#090707;padding:34px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;">
                    <tr>
                        <td style="padding:0 6px 18px;text-align:left;">
                            <div style="font-size:22px;line-height:1;font-weight:900;color:#fff8f6;">
                                Horizon <span style="color:#ef4444;">Boost</span>
                            </div>
                            <div style="margin-top:8px;color:#a99a9a;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
                                Segurança da conta
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #5f2020;border-radius:26px;overflow:hidden;background:#181111;box-shadow:0 26px 70px rgba(0,0,0,.42);">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding:34px 30px 24px;background:#241717;background-image:linear-gradient(135deg,#3b1717 0%,#211616 52%,#0f0b0b 100%);">
                                        <div style="display:inline-block;margin-bottom:18px;padding:8px 12px;border:1px solid rgba(239,68,68,.55);border-radius:999px;background:rgba(239,68,68,.12);color:#fecaca;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">
                                            Código de verificação
                                        </div>
                                        <h1 style="margin:0;color:#fff8f6;font-size:34px;line-height:1.08;font-weight:900;">
                                            {{ $headline }}
                                        </h1>
                                        <p style="margin:16px 0 0;color:#d8c8c8;font-size:16px;line-height:1.65;">
                                            {{ $intro }}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:30px;text-align:center;background:#181111;">
                                        <div style="display:inline-block;width:100%;max-width:360px;border:1px solid #9f3030;border-radius:20px;background:#0d0a0a;padding:20px 18px;">
                                            <div style="color:#aa9c9c;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">
                                                Seu código
                                            </div>
                                            <div style="margin-top:10px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:42px;line-height:1;font-weight:900;letter-spacing:.22em;">
                                                {{ $token }}
                                            </div>
                                        </div>
                                        <p style="margin:18px auto 0;max-width:430px;color:#bbaaaa;font-size:14px;line-height:1.7;">
                                            Este código expira em <strong style="color:#fff8f6;">{{ $expiresInMinutes }} minutos</strong>.
                                            Use-o apenas dentro da Horizon Boost para concluir a autenticação ou verificação solicitada.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:0 30px 34px;text-align:center;background:#181111;">
                                        <a href="{{ $frontendUrl }}" style="display:inline-block;border-radius:14px;background:#dc2626;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;padding:15px 24px;">
                                            Abrir Horizon Boost
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 6px 0;text-align:left;">
                            <p style="margin:0;color:#897b7b;font-size:12px;line-height:1.65;">
                                Se você não solicitou este código, ignore este e-mail. A Horizon Boost nunca pede sua senha por e-mail.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
