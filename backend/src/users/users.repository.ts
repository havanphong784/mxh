import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma.client;
  }

  get user() {
    return this.prisma.client.orm.public.User;
  }

  get follow() {
    return this.prisma.client.orm.public.Follow;
  }

  get session() {
    return this.prisma.client.orm.public.Session;
  }

  async findById(userId: string) {
    return this.user.where((u) => u.id.eq(userId)).first();
  }

  async findByUsername(username: string) {
    return this.user
      .where((u) => u.username.eq(username.toLowerCase()))
      .first();
  }

  async findFollow(followerId: string, followingId: string) {
    return this.follow
      .where((f) => f.followerId.eq(followerId))
      .where((f) => f.followingId.eq(followingId))
      .first();
  }

  async countFollowers(userId: string): Promise<number> {
    const agg = await this.follow
      .where((f) => f.followingId.eq(userId))
      .where((f) => f.follower.some((u) => u.isActive.eq(true)))
      .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
      .aggregate((a) => ({ total: a.count() }));
    return Number(agg.total) || 0;
  }

  async countFollowing(userId: string): Promise<number> {
    const agg = await this.follow
      .where((f) => f.followerId.eq(userId))
      .where((f) => f.following.some((u) => u.isActive.eq(true)))
      .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
      .aggregate((a) => ({ total: a.count() }));
    return Number(agg.total) || 0;
  }
}
