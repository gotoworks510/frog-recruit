import type { Metadata } from "next";
import { LegalH2, LegalH3, LegalShell } from "@/components/brand/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy · Frog Recruit",
  description:
    "Draft privacy policy for personal information handled in Frog Recruit.",
};

const LAST_UPDATED = "18 September 2026";

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle={`Frog Recruit · Last updated: ${LAST_UPDATED}`}
    >
      <section className="space-y-3">
        <LegalH2>1. Who we are</LegalH2>
        <p>
          Frog Creator Production Inc. (“Frog,” “we,” “us,” or “our”) operates
          Frog Recruit, a private introduction portal at recruit.frogagent.com
          (and related domains), including the{" "}
          <strong>Frog Recruit</strong> and{" "}
          <strong>Frog Recruit for Employers</strong> iOS apps.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Address:</strong> 1508-6699 Dunblane Avenue, Burnaby, BC
            V5H 0J8, Canada
          </li>
          <li>
            <strong>Phone:</strong> +1 (778) 829-3060
          </li>
          <li>
            <strong>Privacy contact:</strong>{" "}
            <a
              href="mailto:info@frogagent.com"
              className="text-primary underline"
            >
              info@frogagent.com
            </a>
          </li>
        </ul>
        <p>
          This Policy explains how we collect, use, disclose, and protect
          personal information in connection with Frog Recruit. It is intended
          to align with the spirit of Frog’s broader privacy practices described
          at{" "}
          <a
            href="https://frogagent.com/terms/"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            frogagent.com/terms
          </a>
          , with detail specific to this Service.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>2. Scope</LegalH2>
        <p>This Policy covers personal information processed when you:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>use Frog Recruit as a candidate or employer user (web or iOS app);</li>
          <li>are invited or administered by Frog staff; or</li>
          <li>communicate with us about introductions made through the Service.</li>
        </ul>
        <p>
          We handle personal information in accordance with applicable Canadian
          privacy law (including PIPEDA and, where applicable, British Columbia’s
          PIPA) and other laws that may apply to you.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>3. Information we collect</LegalH2>
        <LegalH3>3.1 Candidates</LegalH3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Identity and contact details (for example name, email, login
            identifiers)
          </li>
          <li>
            Profile content (headline, experience, links, location preferences,
            work-authorization status and related notes you or Frog record)
          </li>
          <li>Résumé files (PDF) and metadata needed to store and deliver them</li>
          <li>
            Sharing consent records (when you allow employers to view shared
            materials; when you revoke)
          </li>
          <li>
            Introduction records (which companies Frog connected you with, status
            notes Frog maintains for coordination)
          </li>
          <li>
            Communications with Frog about your introductions and account
          </li>
        </ul>
        <LegalH3>3.2 Employer users</LegalH3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name, work email, company affiliation, and account credentials</li>
          <li>
            Feedback on introductions (for example Interested / Maybe / Not
            interested and free-text comments)
          </li>
          <li>
            Access and viewing activity needed for security and accountability
            (see below)
          </li>
        </ul>
        <LegalH3>3.3 Technical and security data</LegalH3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Approximate device/browser information, IP address, timestamps, and
            request logs
          </li>
          <li>
            Authentication events (including Google sign-in where used on the
            web portal)
          </li>
          <li>
            On the iOS apps: device identifiers used to deliver push
            notifications and keep your session signed in on that device;
            notification preference settings you choose
          </li>
          <li>
            Audit records when employers view candidate materials or download
            watermarked résumés
          </li>
        </ul>
        <LegalH3>3.4 Information Frog creates</LegalH3>
        <p>
          Frog may create recommendation text, fit ratings (“Frog score”), and
          internal notes. Frog scores and full recommendation content are shown
          to authorized employers; they are not presented to candidates in the
          candidate portal preview. Internal staff notes are for Frog’s
          operations and are not shared with employers through the employer DTO.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>4. How we use personal information</LegalH2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Operate accounts and authenticate users</li>
          <li>
            Prepare and deliver introductions between candidates and employers
          </li>
          <li>
            Enforce consent and company-specific access grants before employers
            can view shared profiles or résumés
          </li>
          <li>
            Apply résumé watermarks and maintain view audit logs as a deterrent
            and accountability measure
          </li>
          <li>Coordinate feedback and next steps</li>
          <li>
            Send optional push notifications about introductions and account
            activity (iOS apps)
          </li>
          <li>Provide support, prevent abuse, and secure the Service</li>
          <li>Improve the Service and keep operational records</li>
          <li>Comply with law and enforce our Terms of Use</li>
        </ul>
      </section>

      <section className="space-y-3">
        <LegalH2>5. When we share personal information</LegalH2>
        <LegalH3>5.1 Employers (with your consent and Frog’s grant)</LegalH3>
        <p>
          Candidate materials are shared with a company only when Frog has
          granted that company access and the candidate’s sharing consent is
          active (and related Service rules are met, such as a published shared
          recommendation where required). Employers receive a minimized view
          designed for evaluation—not unrestricted exports of all Frog
          internal data.
        </p>
        <LegalH3>5.2 Service providers</LegalH3>
        <p>
          We use processors to host and operate the Service, which may include
          cloud infrastructure (for example Cloudflare for application hosting,
          database, and file storage), email delivery (for example Resend), push
          notification delivery (for example Apple Push Notification service and
          Expo&apos;s push service for the iOS apps), and authentication
          providers (for example Google for web sign-in where used). They
          process data on our instructions and for providing those services.
        </p>
        <LegalH3>5.3 Legal and safety</LegalH3>
        <p>
          We may disclose information if required by law, court order, or public
          authority, or if necessary to protect rights, safety, or security.
        </p>
        <LegalH3>5.4 No sale of personal information</LegalH3>
        <p>
          We do not sell candidate or employer personal information as a
          commercial data product.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>6. Cross-border processing</LegalH2>
        <p>
          Frog is based in British Columbia, Canada. Service providers may
          process data in Canada, the United States, or other countries where
          they operate. Where data leaves Canada, we take steps appropriate to
          the context (contractual and organizational measures) so that
          information continues to receive a comparable level of protection.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>7. Retention</LegalH2>
        <p>
          We keep personal information only as long as needed for introductions,
          account administration, dispute resolution, security/audit, and legal
          obligations. Audit logs of résumé and profile views are kept as
          append-only operational records. When information is no longer needed,
          we delete or de-identify it in line with our retention practices.
        </p>
        <p>
          Exact periods may vary by record type; contact us if you need details
          about your situation.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>8. Security</LegalH2>
        <p>
          We use administrative, technical, and organizational measures
          appropriate to the sensitivity of recruitment data (access controls,
          encrypted transport, authenticated sessions, and résumé watermarks for
          employer downloads). No method of transmission or storage is fully
          secure. Watermarking discourages misuse; it does not prevent screenshots
          or printing.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>9. Your choices and rights</LegalH2>
        <p>Depending on applicable law, you may request to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>access personal information we hold about you;</li>
          <li>correct inaccurate information;</li>
          <li>withdraw sharing consent (candidates) through the Service or by contacting us;</li>
          <li>
            request account deletion from the iOS app (Account → Request account
            deletion) or by emailing us — we confirm before completing deletion,
            subject to legal and operational limits (for example audit trails);
            and
          </li>
          <li>ask questions about our privacy practices.</li>
        </ul>
        <p>
          Email{" "}
          <a
            href="mailto:info@frogagent.com"
            className="text-primary underline"
          >
            info@frogagent.com
          </a>{" "}
          with enough detail for us to verify your identity and respond. We may
          need to confirm you are the individual concerned or an authorized
          agent.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>10. Cookies and similar technologies</LegalH2>
        <p>
          The Service uses cookies or similar technologies as needed for
          authentication, security, and basic operation of the portal. We do not
          operate Frog Recruit as an advertising marketplace. Analytics, if
          enabled on public pages, is used to understand traffic and improve the
          site—not to sell personal profiles.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>11. Children</LegalH2>
        <p>
          Frog Recruit is intended for adults participating in professional
          hiring. We do not knowingly collect personal information from children
          under 16 (or a higher age if required by local law).
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>12. Changes to this Policy</LegalH2>
        <p>
          We may update this Policy by posting a revised version on the Service
          with an updated date. Material changes will be highlighted when
          practical.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>13. Contact</LegalH2>
        <p>
          Privacy questions or requests:{" "}
          <a
            href="mailto:info@frogagent.com"
            className="text-primary underline"
          >
            info@frogagent.com
          </a>
          .
        </p>
        <p>
          Frog Creator Production Inc.
          <br />
          1508-6699 Dunblane Avenue
          <br />
          Burnaby, BC V5H 0J8, Canada
          <br />
          Tel: +1 (778) 829-3060
        </p>
      </section>
    </LegalShell>
  );
}
