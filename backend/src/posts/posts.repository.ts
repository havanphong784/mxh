import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma.client;
  }

  get post() {
    return this.prisma.client.orm.public.Post;
  }

  get media() {
    return this.prisma.client.orm.public.PostMedia;
  }

  get like() {
    return this.prisma.client.orm.public.PostLike;
  }

  get bookmark() {
    return this.prisma.client.orm.public.PostBookmark;
  }

  async findById(postId: string) {
    return this.post.where({ id: postId }).first();
  }

  async findByIdWithMedia(postId: string) {
    return this.post.where({ id: postId }).include("media").first();
  }

  async findByIdWithAuthor(postId: string) {
    return this.post.where({ id: postId }).include("author").first();
  }

  async findLike(userId: string, postId: string) {
    return this.like
      .where((l) => l.userId.eq(userId))
      .where((l) => l.postId.eq(postId))
      .first();
  }

  async findBookmark(userId: string, postId: string) {
    return this.bookmark
      .where((b) => b.userId.eq(userId))
      .where((b) => b.postId.eq(postId))
      .first();
  }

  async findRepost(authorId: string, repostOfId: string) {
    return this.post.where({ authorId, repostOfId }).first();
  }

}
