import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { PostsService } from '../posts/posts.service.js';

async function run() {
  console.log('--- BẮT ĐẦU ĐỐI SOÁT BỘ ĐẾM BÀI VIẾT (POST COUNTERS RECONCILIATION) ---');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const postsService = app.get(PostsService);
    const result = await postsService.reconcileCounters();

    console.log(`\n Quét hoàn tất:`);
    console.log(`- Tổng số bài viết đã kiểm tra: ${result.totalScanned}`);
    console.log(`- Số bài viết có sai lệch đã được hiệu chỉnh: ${result.correctedCount}`);

    if (result.discrepancies.length > 0) {
      console.log('\nChi tiết các bài viết đã được sửa sai:');
      console.table(
        result.discrepancies.map((d) => ({
          postId: d.postId,
          'Likes (Cũ -> Mới)': `${d.before.likeCount} -> ${d.after.likeCount}`,
          'Bookmarks (Cũ -> Mới)': `${d.before.bookmarkCount} -> ${d.after.bookmarkCount}`,
          'Reposts (Cũ -> Mới)': `${d.before.repostCount} -> ${d.after.repostCount}`,
          'Quotes (Cũ -> Mới)': `${d.before.quoteCount} -> ${d.after.quoteCount}`,
          'Replies (Cũ -> Mới)': `${d.before.replyCount} -> ${d.after.replyCount}`,
        })),
      );
    } else {
      console.log(' Tất cả các bộ đếm đều đồng bộ hoàn hảo!');
    }
  } catch (error) {
    console.error(' Lỗi trong quá trình đối soát:', error);
  } finally {
    await app.close();
  }
}

run();
