import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { seedCategories, seedArticles } from '@/lib/help-seed-data';

// POST /api/help/seed - Seed help articles and categories
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    let categoriesCreated = 0;
    let articlesCreated = 0;

    // ── Seed Categories ──────────────────────────────────────────────────────
    for (const cat of seedCategories) {
      const existing = await db.helpCategory.findUnique({
        where: { slug: cat.slug },
      });

      if (!existing) {
        await db.helpCategory.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
          },
        });
        categoriesCreated++;
      }
    }

    // ── Seed Articles ───────────────────────────────────────────────────────
    for (const article of seedArticles) {
      const existing = await db.helpArticle.findFirst({
        where: {
          slug: article.slug,
          tenantId: user.tenantId,
        },
      });

      if (!existing) {
        await db.helpArticle.create({
          data: {
            tenantId: user.tenantId,
            title: article.title,
            slug: article.slug,
            content: article.content,
            excerpt: article.excerpt,
            category: article.category,
            tags: article.tags,
            status: 'published',
            viewCount: article.viewCount,
            helpfulCount: article.helpfulCount,
            notHelpfulCount: Math.floor(article.helpfulCount * 0.15),
            authorId: user.id,
            publishedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
          },
        });
        articlesCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesCreated,
        articles: articlesCreated,
        message: `Seeded ${categoriesCreated} categories and ${articlesCreated} articles`,
      },
    });
  } catch (error) {
    console.error('Error seeding help data:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to seed help data' } },
      { status: 500 }
    );
  }
}
