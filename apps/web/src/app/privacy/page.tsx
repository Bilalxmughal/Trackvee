import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Privacy Policy | TrackVee',
  description: 'Learn how TrackVee collects, uses and protects your personal data and vehicle tracking information.',
};

const sections = [
  {
    title: '1. Information We Collect',
    body: `We collect the following types of information when you use TrackVee:\n\n- **Account information:** Name, email address, phone number, and billing details provided during registration.\n- **Vehicle & location data:** GPS coordinates, speed, route history, and ignition events from installed tracking devices.\n- **Usage data:** Pages visited, features used, device type, browser, and IP address.\n- **Communications:** Messages you send us via email, WhatsApp, or our contact form.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `Your information is used to:\n\n- Provide live GPS tracking, alerts, and trip history through the TrackVee platform.\n- Process payments and send account-related notifications.\n- Improve our services, fix issues, and develop new features.\n- Respond to your support requests and inquiries.\n- Display relevant advertising on our blog and marketing pages (Google AdSense).`,
  },
  {
    title: '3. Cookies',
    body: `TrackVee uses cookies to:\n\n- Keep you logged into the platform.\n- Remember your preferences (e.g., language, dismissed notices).\n- Measure website traffic via Google Analytics.\n- Serve relevant advertisements via Google AdSense.\n\nYou can decline non-essential cookies using the banner shown on your first visit. Essential cookies required for login cannot be disabled.`,
  },
  {
    title: '4. Sharing Your Data',
    body: `We do not sell your personal data. We may share data with:\n\n- **Service providers:** Cloud hosting (Oracle), payment processors, and email services — only as needed to operate TrackVee.\n- **Google:** Analytics and AdSense data is governed by Google's Privacy Policy.\n- **Legal authorities:** If required by law or to protect the rights and safety of our users.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your account data for as long as your account is active. Vehicle location history is stored for up to 12 months by default. You may request deletion of your data at any time by contacting support@trackvee.com.`,
  },
  {
    title: '6. Your Rights',
    body: `You have the right to:\n\n- Access the personal data we hold about you.\n- Request correction of inaccurate data.\n- Request deletion of your data (subject to legal obligations).\n- Withdraw consent for marketing communications at any time.\n\nTo exercise any of these rights, contact us at support@trackvee.com.`,
  },
  {
    title: '7. Security',
    body: `We take reasonable technical and organisational measures to protect your data, including encrypted connections (HTTPS), access controls, and regular security reviews. However, no internet service can guarantee absolute security.`,
  },
  {
    title: '8. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page will reflect any changes. Continued use of TrackVee after changes constitutes acceptance of the revised policy.`,
  },
  {
    title: '9. Contact Us',
    body: `If you have any questions about this Privacy Policy, please contact:\n\n**TrackVee**\nsupport@trackvee.com\nLahore, Pakistan`,
  },
];

function renderBody(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="flex gap-2 text-gray-600 text-sm leading-relaxed">
          <span className="text-brand mt-1 shrink-0">—</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-800">$1</strong>') }} />
        </li>
      );
    }
    if (!line.trim()) return null;
    return (
      <p key={i} className="text-gray-600 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-800">$1</strong>') }} />
    );
  });
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <section className="px-8 lg:px-16 py-16 border-b border-gray-100">
          <p className="text-xs font-bold tracking-widest uppercase text-brand mb-3">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: October 2026</p>
        </section>

        <section className="px-8 lg:px-16 py-14 max-w-3xl">
          <p className="text-gray-600 text-sm leading-relaxed mb-10">
            TrackVee (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your personal data when you use our GPS vehicle tracking services at trackvee.com.
          </p>

          <div className="space-y-10">
            {sections.map(s => (
              <div key={s.title}>
                <h2 className="text-base font-extrabold text-gray-900 mb-3">{s.title}</h2>
                <div className="space-y-2">
                  {s.body.includes('\n- ') ? (
                    <>
                      {s.body.split('\n\n').map((block, i) => {
                        if (block.startsWith('- ') || block.includes('\n- ')) {
                          return (
                            <ul key={i} className="space-y-1.5 ml-1">
                              {renderBody(block)}
                            </ul>
                          );
                        }
                        return <div key={i}>{renderBody(block)}</div>;
                      })}
                    </>
                  ) : (
                    renderBody(s.body)
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 pt-8 border-t border-gray-100">
            <Link href="/" className="text-xs font-semibold text-brand hover:underline">← Back to TrackVee</Link>
          </div>
        </section>
      </main>
    </>
  );
}
