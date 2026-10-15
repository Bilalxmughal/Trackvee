import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { posts, getPost, formatDate } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return posts.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | TrackVee Blog`,
    description: post.description,
    keywords: post.keywords.join(', '),
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

function renderContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-xl font-extrabold text-gray-900 mt-10 mb-3 leading-snug">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-4 space-y-2 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-gray-600 text-base leading-relaxed">
              <span className="text-brand font-bold mt-0.5 shrink-0">—</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>') }} />
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line === '---') {
      elements.push(<hr key={i} className="border-gray-100 my-10" />);
    } else if (line.trim()) {
      elements.push(
        <p
          key={i}
          className="text-gray-600 text-base leading-[1.85] my-4"
          dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900 font-semibold">$1</strong>')
              .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-brand font-semibold underline underline-offset-2 hover:text-brand-dark">$1</a>'),
          }}
        />
      );
    }
    i++;
  }
  return elements;
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = posts.filter(p => p.slug !== slug && p.category === post.category).slice(0, 2);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { '@type': 'Organization', name: 'TrackVee' },
    publisher: { '@type': 'Organization', name: 'TrackVee', url: 'https://trackvee.com' },
    keywords: post.keywords.join(', '),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-8 lg:px-16 py-3">
        <nav className="flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-brand transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-brand transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{post.title}</span>
        </nav>
      </div>

      {/* Article header */}
      <section className="bg-white px-8 lg:px-16 py-12 border-b border-gray-100">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-semibold text-brand bg-red-50 px-2.5 py-1 rounded-full">{post.category}</span>
            <span className="text-xs text-gray-400">{post.readTime}</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-gray-500 text-base leading-relaxed mb-6">{post.description}</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">TV</div>
            <div>
              <p className="text-xs font-semibold text-gray-800">TrackVee Team</p>
              <p className="text-xs text-gray-400">{formatDate(post.date)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="bg-gray-50 px-8 lg:px-16 py-14">
        <div className="flex flex-col lg:flex-row gap-14">

          {/* Article content */}
          <article className="flex-1 max-w-2xl">
            {/* Ad top */}
            <div className="h-16 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium mb-10">
              Advertisement
            </div>

            <div className="prose-custom">
              {renderContent(post.content)}
            </div>

            {/* Ad bottom */}
            <div className="h-16 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium mt-12">
              Advertisement
            </div>

            {/* Related */}
            {related.length > 0 && (
              <div className="mt-12">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Related articles</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {related.map(r => (
                    <Link key={r.slug} href={`/blog/${r.slug}`} className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-brand/30 transition-all">
                      <span className="text-xs text-brand font-semibold">{r.category}</span>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-brand transition-colors leading-snug mt-1 mb-1">{r.title}</p>
                      <p className="text-xs text-gray-400">{r.readTime}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="lg:w-60 shrink-0 space-y-6">
            <div className="h-56 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
              Advertisement
            </div>

            <div className="bg-brand rounded-2xl p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Get started</p>
              <h3 className="font-extrabold text-sm mb-2 leading-snug">Track your vehicles today</h3>
              <p className="text-white/80 text-xs mb-4 leading-relaxed">Professional installation across Pakistan. Personal and fleet plans available.</p>
              <Link href="/#contact" className="inline-block bg-white text-brand font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                Get a quote
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">More articles</p>
              <div className="divide-y divide-gray-100">
                {posts.filter(p => p.slug !== slug).map(p => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="block group py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-brand transition-colors leading-snug">{p.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.readTime}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="h-56 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-300 font-medium">
              Advertisement
            </div>
          </aside>

        </div>
      </section>

    </main>
  );
}
