// external dependencies
import * as nodemailer from 'nodemailer';
import * as SMTPPool from 'nodemailer/lib/smtp-pool';
import * as Mailer from 'nodemailer/lib/mailer';
import * as Mustache from 'mustache';
// local dependencies
import * as fileutils from '../utils/fileutils';
import * as auth0 from '../auth0/users';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



let transporter: nodemailer.Transporter | undefined;


export function init(): Promise<void> {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT &&
        process.env.SMTP_USER && process.env.SMTP_PASS &&
        process.env.SMTP_REPLY_TO)
    {
        const mailOptions: SMTPPool.Options = {
            name : 'machinelearningforkids.co.uk',
            host : process.env.SMTP_HOST,
            port : parseInt(process.env.SMTP_PORT, 10),
            secure : true,
            auth : {
                user : process.env.SMTP_USER,
                pass : process.env.SMTP_PASS,
            },
            pool : true,
        };
        const mailDefaults = {
            from : 'Machine Learning for Kids <' + process.env.SMTP_USER + '>',
            replyTo : process.env.SMTP_REPLY_TO,
        };

        const verifyTransporter = nodemailer.createTransport(mailOptions, mailDefaults);

        return verifyTransporter.verify()
            .then(() => {
                transporter = verifyTransporter;

                log.info('Email credentials verified');
            })
            .catch((err) => {
                log.error({ err }, 'Failed to verify email credentials. Email sending disabled.');
            });
    }
    else {
        log.info('Missing required fields for sending email. Email sending disabled.');
        return Promise.resolve();
    }
}


export function close() {
    if (transporter) {
        transporter.close();
        transporter = undefined;
    }
}


export async function invalidCredentials(tenant: string, failure: InvalidCredentialsEmail): Promise<void> {
    return sendEmail(tenant, EMAILS.invalidcredentials, failure);
}
export async function unknownConvClassifier(tenant: string, details: UnmanagedConvClassifier): Promise<void> {
    return sendEmail(tenant, EMAILS.unmanagedconv, details);
}
export async function unknownVisrecClassifier(tenant: string, details: UnmanagedVisRecClassifier): Promise<void> {
    return sendEmail(tenant, EMAILS.unmanagedvisrec, details);
}

export interface InvalidCredentialsEmail {
    readonly errormessage: string;
    readonly userid: string;
    readonly servicename: 'Watson Assistant' | 'Visual Recognition';
}
export interface UnmanagedConvClassifier {
    readonly workspace: string;
}
export interface UnmanagedVisRecClassifier {
    readonly classifier: string;
}


const EMAILS: { [key: string]: EmailTemplate } = {
    invalidcredentials : {
        root : './resources/email-invalid-ibmcloud-creds.',
        subject : 'Invalid IBM Cloud credentials',
    },
    unmanagedconv : {
        root : './resources/email-unmanaged-conv-classifier.',
        subject : 'Unknown Watson Assistant workspace',
    },
    unmanagedvisrec : {
        root : './resources/email-unmanaged-visrec-classifier.',
        subject : 'Unknown Visual Recognition classifier',
    },
};











async function sendEmail(tenant: string, templateinfo: EmailTemplate, values: EmailValues): Promise<void> {
    if (!transporter) {
        log.error('Skipping sending email as sender not initialized');
        return;
    }

    const teacher = await auth0.getTeacherByClassId(tenant);
    if (!teacher || !teacher.email) {
        log.error({ tenant }, 'Failed to retrieve email address to notify teacher');
        return;
    }

    const TEMPLATE_ROOT = templateinfo.root;
    const templateText: string = await fileutils.read(TEMPLATE_ROOT + 'txt');
    const templateHtml: string = await fileutils.read(TEMPLATE_ROOT + 'html');

    const email: Mailer.Options = {
        subject : templateinfo.subject,
        to : teacher.email,
        text : Mustache.render(templateText, values),
        html : Mustache.render(templateHtml, values),
    };

    return transporter.sendMail(email);
}



interface EmailTemplate {
    readonly root: string;
    readonly subject: string;
}

type EmailValues = InvalidCredentialsEmail |
                   UnmanagedConvClassifier |
                   UnmanagedVisRecClassifier;



