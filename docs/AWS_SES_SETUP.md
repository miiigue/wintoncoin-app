# Guía paso a paso: verificación por correo (OTP) con AWS SES (estilo fintech)

Esta guía te deja el sistema funcionando en **producción** con **AWS SES**, con buena entregabilidad (DKIM/SPF/DMARC), seguridad y un correo elegante.

## 0) Qué vas a lograr

- El usuario se registra y recibe un **código OTP de 6 dígitos** por email.
- El código **expira**, tiene **límite de intentos**, y el reenvío tiene **cooldown**.
- El correo sale con tu dominio (`no-reply@wintoncoin.com`) con configuración de entregabilidad tipo fintech.

## 1) Decide el “From” profesional (recomendado)

- **From**: `WintonCoin <no-reply@wintoncoin.com>`
- **Soporte**: `support@wintoncoin.com` (puede ser el mismo dominio)
- **Subdominio para mail** (opcional pero recomendable): `mail.wintoncoin.com` para MAIL FROM / Return-Path.

## 2) AWS SES: elegir región (muy importante)

Elige una sola región para SES, por ejemplo:

- `us-east-1` (común)
- `eu-west-1` (si quieres más cerca de Europa)

Esa región debe coincidir con tu variable `AWS_REGION`.

## 3) Verificar tu dominio en SES (lo mejor para fintech)

En AWS Console:

- Ve a **Amazon SES** → **Verified identities** → **Create identity**
- Elige **Domain**
- Escribe tu dominio: `wintoncoin.com`
- Activa **DKIM** (Easy DKIM)

AWS te dará **3 CNAME** (DKIM). Debes agregarlos en tu DNS (Hostinger / donde tengas el dominio).

### DNS (DKIM)

- Agrega los **3 registros CNAME** EXACTOS que te da AWS.
- Espera propagación (a veces 5–60 min).
- En SES revisa que el estado pase a **Verified**.

## 4) SPF (obligatorio)

En el DNS del dominio raíz (`wintoncoin.com`), crea/ajusta un TXT:

- **Nombre/Host**: `@` (o vacío, depende del panel)
- **Tipo**: TXT
- **Valor**:

`v=spf1 include:amazonses.com -all`

> Si ya tienes SPF por otro proveedor, hay que combinarlo en un solo registro (no puedes tener 2 SPF separados).

## 5) DMARC (muy recomendado para fintech)

Crea un TXT:

- **Nombre/Host**: `_dmarc`
- **Tipo**: TXT
- **Valor (recomendado inicial)**:

`v=DMARC1; p=quarantine; rua=mailto:dmarc@wintoncoin.com; adkim=s; aspf=s; pct=100`

Cuando todo esté estable, puedes subir a `p=reject` (más estricto).

## 6) (Opcional pero pro) Configurar MAIL FROM (Return-Path)

Esto ayuda a alineación SPF/DMARC y “look” fintech.

En SES → tu identity del dominio → **Mail-from domain**

- Configura: `mail.wintoncoin.com`

AWS te pedirá:

- **MX** para `mail.wintoncoin.com` apuntando a `feedback-smtp.<REGION>.amazonses.com`
- **TXT** para `mail.wintoncoin.com` con SPF (AWS te lo indica; normalmente incluye amazonses)

## 7) Salir del “Sandbox” (si aplica)

Si tu SES está en **sandbox**:

- Solo podrás enviar a destinatarios verificados.

Para producción:

- SES → **Account dashboard** → **Request production access** (o equivalente)
- Explica que usarás “Transactional email” (OTP) y tu caso fintech.

## 8) IAM: credenciales seguras (mínimo privilegio)

Lo más simple (para Render/hosting fuera de AWS):

1. IAM → Users → Create user
2. Permisos: crea una policy mínima (solo enviar email)
3. Crea **Access Key** y **Secret Access Key**

Ejemplo de policy mínima (ajusta identity):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

> Más pro: restringir por identity ARN, pero primero hazlo funcionar.

## 9) Variables de entorno que debes configurar (backend)

En tu hosting (por ejemplo Render) y/o `.env` local, agrega:

- **AWS_REGION**: `us-east-1` (ejemplo)
- **AWS_ACCESS_KEY_ID**: (tu access key)
- **AWS_SECRET_ACCESS_KEY**: (tu secret key)
- **SES_FROM_EMAIL**: `no-reply@wintoncoin.com`
- **SES_FROM_NAME**: `WintonCoin`
- **SUPPORT_EMAIL**: `support@wintoncoin.com`
- **OTP_SECRET**: un secreto largo (mínimo 32 bytes aleatorios)
- **BRAND_PRIMARY_COLOR**: `#0B5FFF` (opcional)
- **BRAND_LOGO_URL**: `https://.../logo.png` (opcional; debe ser público y https)

### Cómo generar OTP_SECRET (Windows)

En PowerShell puedes usar Node:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia ese valor a `OTP_SECRET`.

## 10) Probar en local (rápido)

1. Entra a `backend/`
2. Asegúrate de tener variables en tu entorno o `.env`
3. Ejecuta:

```bash
npm start
```

Luego en el frontend intenta registrarte:

- Debe llegar el OTP por correo.
- Si SES no está configurado, en dev el OTP se imprime en consola (para no bloquearte).

## 11) Checklist de “correo fintech elegante”

Recomendaciones que ya aplicamos en el template:

- Diseño limpio, fondo claro, tarjeta con borde/sombra suave.
- Código en tipografía monoespaciada y muy visible.
- “Preheader” oculto (se ve bonito en bandeja de entrada).
- Aviso anti-phishing (“nunca compartas tu código”).
- Soporte visible.

Recomendaciones adicionales (buenas prácticas):

- Mantén el email corto: OTP + expiración + seguridad.
- No uses links para OTP (para reducir phishing).
- No incluyas datos sensibles.

## 12) Producción: observabilidad (recomendado)

Más adelante puedes añadir:

- SNS para bounces/complaints
- Métricas (CloudWatch) para tasa de rebote
- Alertas si suben bounces/complaints

