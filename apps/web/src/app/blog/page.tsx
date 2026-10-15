import type { Metadata } from 'next';
import Link from 'next/link';
import { posts, formatDate } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog — GPS Tracking Tips & Fleet Management | TrackVee',
  description: 'Expert articles on GPS vehicle tracking, fleet management, and vehicle security in Pakistan.',
  keywords: 'GPS tracking Pakistan blog, fleet management tips, vehicle tracking articles',
};

export default function BlogPage() {
  return (
    <main>

      {/* Hero */}
      <section className="bg-white px-8 lg:px-16 py-20 border-b border-gray-100">
        <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          Resources &amp; Blog
        </span>
        <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 max-w-2xl leading-tight">
          GPS Tracking Insights for Pakistan.
        </h1>
        <p className="text-gray-500 text-base max-w-xl leading-relaxed">
          Practical guides on fleet management, vehicle security and GPS tracking — written for individuals and businesses across Pakistan.
        </p>
      </section>

      {/* Ad — leaderboard */}
      <div className="bg-gray-50 px-8 lg:px-16 py-4">
        <div className="w-full h-20 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
          Advertisement
        </div>
      </div>

      {/* Content */}
      <section className="bg-gray-50 px-8 lg:px-16 py-14">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* Post grid */}
          <div className="flex-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Latest articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {posts.map((post, i) => (
                <div key={post.slug}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col bg-white rounded-2xl border border-gray-100 p-6 hover:border-brand/30 hover:shadow-sm transition-all h-full"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-semibold text-brand bg-red-50 px-2.5 py-1 rounded-full">{post.category}</span>
                      <span className="text-xs text-gray-400">{post.readTime}</span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug group-hover:text-brand transition-colors flex-1">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-5">{post.description}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">{formatDate(post.date)}</span>
                      <span className="text-xs font-semibold text-brand">Read →</span>
                    </div>
                  </Link>
                  {/* Ad between every 2 posts */}
                  {(i + 1) % 2 === 0 && i < posts.length - 1 && (
                    <div className="md:col-span-2 mt-5 h-16 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
                      Advertisement
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0 space-y-6">

            {/* Ad */}
            <div className="h-56 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
              Advertisement
            </div>

            {/* CTA card */}
            <div className="bg-brand rounded-2xl p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Get started</p>
              <h3 className="font-extrabold text-base mb-2 leading-snug">Track your vehicles across Pakistan</h3>
              <p className="text-white/80 text-xs mb-4 leading-relaxed">Professional installation. Personal and fleet plans available.</p>
              <Link href="/#contact" className="inline-block bg-white text-brand font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                Get a quote
              </Link>
            </div>

            {/* Popular */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Popular articles</p>
              <div className="divide-y divide-gray-100">
                {posts.slice(0, 3).map(p => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="block group py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-brand transition-colors leading-snug">{p.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.readTime}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Ad 2 */}
            <div className="h-56 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
              Advertisement
            </div>

          </aside>
        </div>
      </section>

    </main>
  );
}
