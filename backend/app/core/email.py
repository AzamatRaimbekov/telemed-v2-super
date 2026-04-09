import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import structlog

from app.core.config import settings

logger = structlog.get_logger()


async def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via SMTP. Returns True if sent, False if SMTP not configured."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        await logger.awarning("email_not_sent", reason="SMTP not configured", to=to_email, subject=subject)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)

        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
        server.quit()

        await logger.ainfo("email_sent", to=to_email, subject=subject)
        return True

    except Exception as e:
        await logger.aerror("email_send_failed", to=to_email, error=str(e))
        return False


async def send_staff_credentials(
    to_email: str,
    staff_name: str,
    login: str,
    password: str,
    position: str = "",
) -> bool:
    """Send login credentials to new staff member."""
    subject = f"MedCore KG — Ваши данные для входа"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #F8FFFE; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #BDEDE0, #7ECDB8); border-radius: 12px; line-height: 48px; font-size: 20px;">🏥</div>
            <h1 style="font-size: 22px; color: #1A1A2E; margin: 12px 0 4px;">MedCore KG</h1>
            <p style="color: #6B7280; font-size: 14px; margin: 0;">Система управления клиникой</p>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E8EDF2; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <p style="color: #1A1A2E; font-size: 15px; margin: 0 0 16px;">
                Здравствуйте, <strong>{staff_name}</strong>!
            </p>
            <p style="color: #64748B; font-size: 14px; margin: 0 0 20px;">
                Для вас создана учётная запись в системе MedCore KG{' (' + position + ')' if position else ''}.
            </p>

            <div style="background: #F0F4FF; border: 1px solid #E0E7FF; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="color: #64748B; font-size: 13px; padding: 4px 0;">Логин:</td>
                        <td style="color: #1A1A2E; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0; font-family: monospace;">{login}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748B; font-size: 13px; padding: 4px 0;">Пароль:</td>
                        <td style="color: #7E78D2; font-size: 14px; font-weight: 700; text-align: right; padding: 4px 0; font-family: monospace; letter-spacing: 1px;">{password}</td>
                    </tr>
                </table>
            </div>

            <p style="color: #EF4444; font-size: 12px; margin: 0; background: #FEF2F2; border-radius: 6px; padding: 8px 12px;">
                ⚠️ При первом входе система попросит сменить пароль.
            </p>
        </div>

        <div style="text-align: center;">
            <a href="http://localhost:5173/login" style="display: inline-block; background: linear-gradient(135deg, #7E78D2, #5B54B0); color: white; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 600;">
                Войти в систему →
            </a>
        </div>

        <p style="color: #94A3B8; font-size: 11px; text-align: center; margin-top: 24px;">
            Это автоматическое сообщение от MedCore KG. Не отвечайте на него.
        </p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_password_reset(
    to_email: str,
    staff_name: str,
    new_password: str,
) -> bool:
    """Send new password after reset."""
    subject = f"MedCore KG — Сброс пароля"
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #F8FFFE; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #BDEDE0, #7ECDB8); border-radius: 12px; line-height: 48px; font-size: 20px;">🔐</div>
            <h1 style="font-size: 22px; color: #1A1A2E; margin: 12px 0 4px;">Сброс пароля</h1>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E8EDF2; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <p style="color: #1A1A2E; font-size: 15px; margin: 0 0 16px;">
                Здравствуйте, <strong>{staff_name}</strong>!
            </p>
            <p style="color: #64748B; font-size: 14px; margin: 0 0 20px;">
                Ваш пароль в системе MedCore KG был сброшен администратором.
            </p>

            <div style="background: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 8px; padding: 16px; text-align: center;">
                <p style="color: #64748B; font-size: 12px; margin: 0 0 8px;">Новый пароль:</p>
                <p style="color: #7E78D2; font-size: 20px; font-weight: 700; margin: 0; font-family: monospace; letter-spacing: 2px;">{new_password}</p>
            </div>

            <p style="color: #EF4444; font-size: 12px; margin: 16px 0 0; background: #FEF2F2; border-radius: 6px; padding: 8px 12px;">
                ⚠️ Обязательно смените пароль при следующем входе.
            </p>
        </div>

        <div style="text-align: center;">
            <a href="http://localhost:5173/login" style="display: inline-block; background: linear-gradient(135deg, #7E78D2, #5B54B0); color: white; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 600;">
                Войти в систему →
            </a>
        </div>

        <p style="color: #94A3B8; font-size: 11px; text-align: center; margin-top: 24px;">
            Если вы не запрашивали сброс пароля, обратитесь к администратору.
        </p>
    </div>
    """
    return await send_email(to_email, subject, html)
