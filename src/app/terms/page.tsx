import type { Metadata } from "next";
import { LegalH2, LegalH3, LegalShell } from "@/components/brand/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Use · Frog Recruit",
  description:
    "Draft terms of use for the Frog Recruit private introduction portal.",
};

const LAST_UPDATED = "16 September 2026";

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Use"
      subtitle={`Frog Recruit · Last updated: ${LAST_UPDATED}`}
    >
      <section className="space-y-3">
        <LegalH2>1. About these Terms</LegalH2>
        <p>
          These Terms of Use (“Terms”) govern access to and use of{" "}
          <strong>Frog Recruit</strong> (the “Service”), the private
          introduction portal operated by Frog Creator Production Inc.
          (“Frog,” “we,” “us,” or “our”) at recruit.frogagent.com and related
          domains.
        </p>
        <p>
          By creating an account, accepting an invitation, logging in, and
          agreeing on the Terms acceptance screen shown the first time you sign
          in, you agree to these Terms. If you do not agree, do not use the
          Service — declining on that screen signs you out.
        </p>
        <p>
          These Terms apply specifically to Frog Recruit. Other Frog offerings
          (membership, Frog School, placement support, and related programs)
          may be governed by separate terms, including the general terms
          published at{" "}
          <a
            href="https://frogagent.com/terms/"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            frogagent.com/terms
          </a>
          . Where those documents conflict with these Terms on Recruit-specific
          matters, these Terms control for the Service.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>2. Provider</LegalH2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Legal name:</strong> Frog Creator Production Inc.
          </li>
          <li>
            <strong>Address:</strong> 1508-6699 Dunblane Avenue, Burnaby, BC
            V5H 0J8, Canada
          </li>
          <li>
            <strong>Phone:</strong> +1 (778) 829-3060
          </li>
          <li>
            <strong>Email:</strong>{" "}
            <a
              href="mailto:info@frogagent.com"
              className="text-primary underline"
            >
              info@frogagent.com
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <LegalH2>3. What Frog Recruit is</LegalH2>
        <p>
          Frog Recruit is a <strong>private, invitation-based introduction
          portal</strong>. Frog may introduce selected candidates to selected
          employers (and the reverse) with context such as profiles, résumés,
          Frog’s written perspective, and related materials.
        </p>
        <p>The Service is not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>an open job board or public candidate marketplace;</li>
          <li>a guarantee of interviews, offers, hiring, or visa outcomes; or</li>
          <li>
            legal, immigration, or employment advice. You remain responsible for
            your own hiring, immigration, and contractual decisions.
          </li>
        </ul>
        <p>
          Access is provided by Frog referral. Self-serve discovery of live
          introductions is not offered.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>4. Accounts and eligibility</LegalH2>
        <LegalH3>4.1 Candidates</LegalH3>
        <p>
          Candidate access is typically by invitation (email credentials and/or
          approved Google sign-in). You must provide accurate information, keep
          your credentials secure, and promptly update your profile, experience,
          links, and résumé when material facts change.
        </p>
        <LegalH3>4.2 Employers</LegalH3>
        <p>
          Employer accounts are issued by Frog to authorized company users. You
          represent that you are authorized to act for the company named on the
          account, and that you will limit access to people who need it for
          evaluating Frog introductions.
        </p>
        <LegalH3>4.3 Frog staff</LegalH3>
        <p>
          Frog administrators may access Service data as needed to operate
          introductions, support users, maintain security, and enforce these
          Terms.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>5. Candidate responsibilities</LegalH2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Share only information you are entitled to share. Do not upload
            confidential material belonging to a current or former employer
            without permission.
          </li>
          <li>
            Résumés must be PDF as required by the Service. You are responsible
            for the accuracy of content you submit.
          </li>
          <li>
            Sharing with employers requires your consent in the Service. Without
            active consent, employers cannot view your shared profile even if
            Frog has prepared an introduction.
          </li>
          <li>
            You may withdraw sharing consent through the Service (or by
            contacting Frog). Withdrawal does not unwind information an employer
            already lawfully received, but it stops further portal access under
            Frog’s access rules.
          </li>
          <li>
            Keep Frog in the loop on employer conversations that started through
            a Frog introduction, so Frog can coordinate next steps appropriately.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <LegalH2>6. Employer responsibilities</LegalH2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Use candidate information solely to evaluate Frog introductions for
            legitimate hiring or engagement purposes at your company.
          </li>
          <li>
            Treat profiles, résumés, Frog scores, recommendations, and related
            materials as confidential. Do not publish them, scrape them, resell
            them, or share them outside people who need them for that evaluation.
          </li>
          <li>
            Do not attempt to circumvent access controls, watermarks, audit
            logging, or invitation limits. Watermarks are a deterrent, not DRM.
          </li>
          <li>
            Prefer feedback through the Service (for example Interested / Maybe
            / Not interested) so Frog can coordinate with the candidate. Do not
            cold-contact candidates using Service data except as Frog arranges
            or as the candidate separately permits.
          </li>
          <li>
            Comply with applicable employment, privacy, and anti-discrimination
            laws in your hiring process.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <LegalH2>7. Frog’s role in introductions</LegalH2>
        <p>
          Frog decides whom to introduce to whom. Frog may prepare written
          perspectives and fit ratings (“Frog score”) for employers. Those
          materials reflect Frog’s judgment at a point in time; they are not a
          warranty of performance, culture fit, or legal work authorization
          outcomes.
        </p>
        <p>
          Hiring decisions, offer terms, contractor agreements, and immigration
          sponsorship remain solely between the employer and the candidate (and
          their advisors).
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>8. Fees</LegalH2>
        <p>
          Referral or introduction fees, if any, are described in the fee
          schedule shown in the Service (and/or in a separate written agreement
          with the employer). If a signed commercial agreement conflicts with
          the on-site summary, the signed agreement prevails for that
          engagement.
        </p>
        <p>
          Candidates are not charged a placement fee through Frog Recruit for
          standard introductions described in the Service.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>9. Content and intellectual property</LegalH2>
        <p>
          Frog owns the Service software, branding, and Frog-authored
          recommendation text and scores. Candidates retain rights in their own
          profile content and résumés, and grant Frog a license to host, process,
          display, and share that content as needed to operate introductions
          under these Terms and the Privacy Policy.
        </p>
        <p>
          Employers receive a limited, non-exclusive right to view shared
          materials for evaluation only—not to copy them into competing
          databases or public channels.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>10. Prohibited conduct</LegalH2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Providing false or misleading information</li>
          <li>Unauthorized access, scraping, or security testing without Frog’s written permission</li>
          <li>Harassment, discrimination, or unlawful use of personal information</li>
          <li>Reselling or redistributing Service content or introductions</li>
          <li>Interfering with other users or Frog’s operations</li>
        </ul>
      </section>

      <section className="space-y-3">
        <LegalH2>11. Suspension and termination</LegalH2>
        <p>
          Frog may suspend or terminate access, revoke introductions, or remove
          content if we reasonably believe these Terms were violated, if
          required by law, or if continued access would harm candidates,
          employers, or Frog. You may stop using the Service at any time.
          Provisions that by nature should survive (confidentiality, IP,
          disclaimers, liability limits, governing law) survive termination.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>12. Disclaimers</LegalH2>
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, FROG DISCLAIMS WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not
          warrant uninterrupted or error-free operation, or that introductions
          will result in any particular outcome.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>13. Limitation of liability</LegalH2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, FROG WILL NOT BE LIABLE FOR
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
          FOR LOST PROFITS, LOST DATA, OR HIRING/IMMIGRATION OUTCOMES, ARISING
          FROM THE SERVICE OR THESE TERMS. FROG’S TOTAL LIABILITY FOR CLAIMS
          RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) FEES YOU
          PAID TO FROG SPECIFICALLY FOR FROG RECRUIT IN THE TWELVE MONTHS BEFORE
          THE CLAIM, OR (B) CAD $100.
        </p>
        <p>
          Some jurisdictions do not allow certain limitations; in those cases,
          the limitation applies to the fullest extent allowed.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>14. Changes</LegalH2>
        <p>
          We may update these Terms by posting a revised version on the Service.
          Material changes will be highlighted when practical. Continued use
          after the effective date constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>15. Governing law and venue</LegalH2>
        <p>
          These Terms are governed by the laws of the Province of British
          Columbia and the federal laws of Canada applicable therein, without
          regard to conflict-of-law rules. Courts in Vancouver, British
          Columbia, have exclusive jurisdiction over disputes arising out of
          these Terms or the Service, subject to any non-waivable consumer
          protections that may apply.
        </p>
      </section>

      <section className="space-y-3">
        <LegalH2>16. Contact</LegalH2>
        <p>
          Questions about these Terms:{" "}
          <a
            href="mailto:info@frogagent.com"
            className="text-primary underline"
          >
            info@frogagent.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
