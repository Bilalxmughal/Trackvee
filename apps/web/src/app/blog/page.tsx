import type { Metadata } from 'next';
import Link from 'next/link';
import { posts, formatDate } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog — GPS Tracking Tips & Fleet Management | TrackVee',
  description: 'Expert articles on GPS vehicle tracking, fleet management, and vehicle security in Pakistan. Learn how to reduce costs and improve visibility.',
  keywords: 'GPS tracking Pakistan blog, fleet management tips, vehicle tracking articles',
  openGraph: {
    title: 'TrackVee Blog — GPS Tracking & Fleet Management',
    description: 'Expert articles on GPS vehicle tracking and fleet management in Pakistan.',
    type: 'website',
  },
};

const categories = ['All', 'Fleet Management', 'Technology', 'Personal Tracking'];

export default function BlogPage() {
  return (
    <>
      <main className="min-h-screen bg-gray-50">

        {/* Hero */}
        <section className="bg-white px-8 lg:px-16 py-16 border-b border-gray-100">
          <div className="max-w-4xl">
            <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
              Resources
            </span>
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
              GPS Tracking Insights<br />for Pakistan.
            </h1>
            <p className="text-gray-500 text-base max-w-xl">
              Practical guides on fleet management, vehicle security and GPS tracking — written for individuals and businesses across Pakistan.
            </p>
          </div>
        </section>

        <div className="px-8 lg:px-16 py-12">

          {/* Ad slot — top leaderboard */}
          <div className="w-full h-24 bg-white border border-dashed border-gray-200 rounded-xl flex items-center justify-center mb-10 text-xs text-gray-300 font-medium">
            Advertisement
          </div>

          <div className="flex flex-col lg:flex-row gap-12">

            {/* Main — post grid */}
            <div className="flex-1">

              {/* Category filter */}
              <div className="flex flex-wrap gap-2 mb-8">
                {categories.map(c => (
                  <span key={c} className={`px-3 py-1 text-xs font-semibold rounded-full border ${c === 'All' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-500'}`}>
                    {c}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {posts.map((post, i) => (
                  <>
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group bg-white rounded-2xl border border-gray-100 p-6 flex flex-col hover:border-brand/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-semibold text-brand bg-red-50 px-2.5 py-1 rounded-full">{post.category}</span>
                        <span className="text-xs text-gray-400">{post.readTime}</span>
                      </div>
                      <h2 className="text-base font-bold text-gray-900 mb-2 leading-snug group-hover:text-brand transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-4">{post.description}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-400">{formatDate(post.date)}</span>
                        <span className="text-xs font-semibold text-brand">Read more →</span>
                      </div>
                    </Link>
                    {/* Ad slot after every 2 posts */}
                    {(i + 1) % 2 === 0 && i < posts.length - 1 && (
                      <div key={`ad-${i}`} className="md:col-span-2 h-20 bg-white border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
                        Advertisement
                      </div>
                    )}
                  </>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:w-72 shrink-0 space-y-6">

              {/* Ad slot — sidebar */}
              <div className="w-full h-64 bg-white border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
                Advertisement
              </div>

              {/* CTA card */}
              <div className="bg-brand rounded-2xl p-6 text-white">
                <h3 className="font-bold text-base mb-2">Ready to track your vehicles?</h3>
                <p className="text-white/80 text-sm mb-4 leading-relaxed">Get professional GPS tracking installed at your location across Pakistan.</p>
                <Link href="/#contact" className="inline-block bg-white text-brand font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Get a quote
                </Link>
              </div>

              {/* Popular posts */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Popular posts</h3>
                <div className="space-y-4">
                  {posts.slice(0, 3).map(p => (
                    <Link key={p.slug} href={`/blog/${p.slug}`} className="block group">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-brand transition-colors leading-snug">{p.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.readTime}</p>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Ad slot — sidebar 2 */}
              <div className="w-full h-64 bg-white border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
                Advertisement
              </div>

            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
