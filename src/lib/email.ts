import React from 'react';
import { Resend } from 'resend';
import { render, Text } from '@react-email/components';
import {
  PasswordEmail,
  type PasswordEmailVariant,
  type PasswordEmailParagraph,
  type PasswordEmailProps,
} from '@/components/emails/password-email';
import WordsReportEmail from '@/components/emails/report-email';
import { formatSpanishDate } from '@/lib/date-utils';

const FROM_EMAIL = 'soporte@duech.cl';

/**
 * Lazily initialize Resend to avoid build-time errors when env vars aren't available
 */
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

/**
 * Generic email sending function to reduce duplication
 */
async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  logPrefix: string,
  attachments?: Array<{ filename: string; content: Buffer }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlContent,
      attachments: attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
      })),
    });

    if (result.error) {
      console.error(`Error sending ${logPrefix}:`, result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to send ${logPrefix}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper function to create formatted email paragraphs.
 * Uses PasswordEmailParagraph type for consistency with email components.
 */
function createEmailParagraph(text: string, className?: string): PasswordEmailParagraph {
  return { text, className };
}

/**
 * Helper function to construct password reset links
 */
function createResetLink(resetToken: string): string {
  const editorHost = process.env.HOST_URL || 'editor.localhost:3000';
  return `http://${editorHost}/cambiar-contrasena?token=${resetToken}`;
}

/**
 * Configuration for each password email variant.
 * Uses PasswordEmailVariant and PasswordEmailParagraph types for type safety.
 */
const PASSWORD_EMAIL_CONFIGS: Record<
  PasswordEmailVariant,
  {
    subject: string;
    getParagraphs: (resetLink?: string) => PasswordEmailParagraph[];
    needsButton: boolean;
    getButtonText?: () => string;
    showInfoBox?: boolean;
    getInfoBoxContent?: () => React.ReactNode;
    getAlertContent?: () => React.ReactNode;
  }
> = {
  welcome: {
    subject: 'Bienvenido a DUECh en línea',
    needsButton: true,
    getButtonText: () => 'Establecer mi contraseña',
    getParagraphs: () => [
      createEmailParagraph(
        'Tu cuenta en el Diccionario de Uso del Español de Chile (DUECh) ha sido creada exitosamente.'
      ),
      createEmailParagraph(
        'Para comenzar a usar tu cuenta, necesitas establecer tu contraseña. Haz clic en el botón de abajo para crear tu contraseña:'
      ),
    ],
  },
  reset: {
    subject: 'Restablece tu contraseña de DUECh en línea',
    needsButton: true,
    getButtonText: () => 'Restablecer contraseña',
    getParagraphs: () => [
      createEmailParagraph(
        'Hemos recibido una solicitud para restablecer tu contraseña en DUECh en línea.'
      ),
      createEmailParagraph('Haz clic en el botón de abajo para establecer una nueva contraseña:'),
    ],
    getAlertContent: () =>
      React.createElement(
        Text,
        { className: 'm-0' },
        'Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.'
      ),
  },
  changed: {
    subject: 'Tu contraseña ha sido actualizada',
    needsButton: false,
    getParagraphs: () => [
      createEmailParagraph(
        'Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
      ),
    ],
    showInfoBox: true,
    getInfoBoxContent: () =>
      React.createElement(
        Text,
        { className: 'm-0 text-sm leading-relaxed text-gray-600' },
        `Fecha: ${new Date().toLocaleString('es-CL', {
          timeZone: 'America/Santiago',
          dateStyle: 'long',
          timeStyle: 'short',
        })}`
      ),
    getAlertContent: () =>
      React.createElement(
        Text,
        { className: 'm-0 text-sm text-red-600' },
        'Si no realizaste este cambio, por favor contacta inmediatamente a nuestro equipo de soporte en soporte@duech.cl'
      ),
  },
};

/**
 * Helper function to send password-related emails using the PasswordEmail component.
 * Uses PasswordEmailProps type for type safety.
 */
async function sendPasswordEmailWithVariant(
  to: string,
  username: string,
  variant: PasswordEmailVariant,
  resetLink?: string
): Promise<{ success: boolean; error?: string }> {
  const config = PASSWORD_EMAIL_CONFIGS[variant];

  // Build PasswordEmailProps
  const emailProps: PasswordEmailProps = {
    username,
    variant,
    paragraphs: config.getParagraphs(resetLink),
    ...(config.needsButton &&
      resetLink && {
        buttonText: config.getButtonText?.(),
        buttonLink: resetLink,
      }),
    ...(config.showInfoBox && {
      showInfoBox: true,
      infoBoxContent: config.getInfoBoxContent?.(),
    }),
    ...(config.getAlertContent && {
      alertContent: config.getAlertContent(),
    }),
  };

  const emailHtml = await render(PasswordEmail(emailProps));
  return sendEmail(to, config.subject, emailHtml, `${variant} email`);
}

/**
 * Sends a welcome email to a newly created user with a link to set their password.
 */
export async function sendWelcomeEmail(
  email: string,
  username: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const resetLink = createResetLink(resetToken);
  return sendPasswordEmailWithVariant(email, username, 'welcome', resetLink);
}

/**
 * Sends a confirmation email after a user successfully changes their password.
 */
export async function sendPasswordChangeConfirmation(
  email: string,
  username: string
): Promise<{ success: boolean; error?: string }> {
  return sendPasswordEmailWithVariant(email, username, 'changed');
}

/**
 * Sends a password reset email when an admin resets a user's password.
 */
export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const resetLink = createResetLink(resetToken);
  return sendPasswordEmailWithVariant(email, username, 'reset', resetLink);
}

/**
 * Sends an email with the words PDF report as an attachment.
 */
export async function sendWordsReport(
  email: string,
  username: string,
  pdfBuffer: Buffer
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const dateStr = formatSpanishDate(now);

  const emailHtml = await render(
    WordsReportEmail({
      username,
      dateStr,
    })
  );

  return sendEmail(email, 'Reporte de palabras - DUECh en línea', emailHtml, 'words report', [
    { filename: `reporte_palabras_${now.toISOString().split('T')[0]}.pdf`, content: pdfBuffer },
  ]);
}
