import inlineCss from "inline-css";
import HtmlMinifier from "html-minifier";
import {
  Attachment as MailerAttachment,
  Options as MailerOptions,
} from "nodemailer/lib/mailer";
import {
  smtpTransport,
} from "../providers/email";
import {
  ITemplates,
  TemplateParameters,
  Templates,
} from "../providers/template";

const sendMail =
  async (
    to: string,
    subject: string,
    html: string,
    text: string,
    attachments: MailerAttachment[] = [],
    otherOptions: Partial<MailerOptions> = {},
  ): Promise<boolean> => {
    try {
      const message: MailerOptions = {
        ...otherOptions,
        from: `"${ process.env.EMAIL_FROM_NAME || "Job Fair" }" <${ process.env.EMAIL_FROM || "dontreply-jobfair@fer.hr" }>`,
        replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || "jobfair@fer.hr",
        to,
        subject: `[Job Fair] ${ subject }`,
        text,
        html,
        attachments,
      };

      await smtpTransport.sendMail(message);

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
;

export class EmailService {
  public static async sendMail<Template extends keyof ITemplates>(
    subject: string,
    to: string,
    template: {
      name: Template,
      parameters: TemplateParameters<Template>,
    },
    otherOptions: Partial<MailerOptions> = {},
  ) {
    return sendMail(
      to,
      subject,
      await this.renderTemplate(
        template.name,
        template.parameters,
      ),
      `${ template.parameters.content.join("\n") }\n\nPozdrav,\nJob Fair Tim\n\nUnska 3, 10000 Zagreb, Hrvatska\ne-mail: jobfair@fer.hr\nweb: jobfair.fer.unizg.hr\nsocial: jobfairfer`,
      [],
      otherOptions,
    );
  }

  private static async renderTemplate<Template extends keyof ITemplates>(
    name: Template,
    parameters: TemplateParameters<Template>,
  ) {
    const rendered = Templates[name](parameters);
    const inlinedCss = await inlineCss(
      rendered,
      {
        url: "https://jobfair.fer.hr/",
        preserveMediaQueries: true,
        applyTableAttributes: true,
        removeHtmlSelectors: false,
      },
    );

    return (
      HtmlMinifier.minify(
        inlinedCss,
        {
          collapseInlineTagWhitespace: true,
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          minifyCSS: {
            level: 2,
          },
          sortAttributes: true,
        },
      )
    );
  }
}
