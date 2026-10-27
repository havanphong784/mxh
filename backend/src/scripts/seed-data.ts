import { createHash } from 'node:crypto';

type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
type NotificationType = 'LIKE' | 'REPLY' | 'REPOST' | 'QUOTE' | 'FOLLOW';
type MediaType = 'IMAGE' | 'VIDEO';
const id = (kind: string, n: number) => `seed_v1_${kind}_${String(n).padStart(3, '0')}`;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

const people: Array<[string, string, string | null]> = [
  ['minhthu', 'Minh Thư', 'Thiết kế sản phẩm ở Hà Nội. Thích giao diện dễ dùng và cà phê buổi sáng.'],
  ['quanghuy', 'Quang Huy', 'Lập trình viên tại Đà Nẵng. Viết về web và những lỗi đã sửa.'],
  ['lananh', 'Lan Anh', 'Giáo viên tiếng Anh. Chia sẻ cách học đều đặn mỗi ngày.'],
  ['ducnam', 'Đức Nam', 'Nhiếp ảnh cuối tuần, kỹ sư dữ liệu ngày thường.'],
  ['haimy', 'Hải My', 'Đọc sách, trồng cây và thử công thức nấu ăn mới.'],
  ['thanhdat', 'Thành Đạt', 'Chạy bộ chậm mà chắc. Đang tập cho cự ly 21 km.'],
  ['ngocmai', 'Ngọc Mai', 'Du lịch tự túc và những trải nghiệm địa phương.'],
  ['tuanviet', 'Tuấn Việt', 'Kỹ sư phần mềm, quan tâm mã nguồn mở và an toàn dữ liệu.'],
  ['bichngoc', 'Bích Ngọc', 'Bác sĩ thú y. Chuyện nhỏ về chăm sóc thú cưng.'],
  ['phuonglinh', 'Phương Linh', 'Minh họa sách thiếu nhi, thích màu xanh lá.'],
  ['khanhhoa', 'Khánh Hòa', 'Làm bánh tại nhà ở Sài Gòn. Ghi lại cả mẻ ngon lẫn mẻ hỏng.'],
  ['hoanglong', 'Hoàng Long', 'Quan tâm giao thông đô thị, xe đạp và không gian công cộng.'],
  ['trangnhung', 'Trang Nhung', 'Nghiên cứu trải nghiệm người dùng. Hỏi nhiều hơn đoán.'],
  ['baoan', 'Bảo An', 'Nhạc indie, phim cũ và những quán cà phê yên tĩnh.'],
  ['kimchi', 'Kim Chi', 'Sinh viên ngành môi trường, học cách sống ít rác hơn.'],
  ['nhatminh', 'Nhật Minh', 'Làm sản phẩm số cho doanh nghiệp nhỏ.'],
  ['mocmai', 'Mộc Mai', null],
  ['quocbao', 'Quốc Bảo', 'Tài khoản đang chờ xác minh email.'],
  ['thuha', 'Thu Hà', 'Tài khoản tạm ngưng để thử trạng thái không hoạt động.'],
];

// Câu chuyện cụ thể, gần với sinh hoạt tại Việt Nam. Mỗi dòng tạo hai tình huống khác nhau.
const stories = [
  'Sáng nay đi bộ quanh Hồ Tây, đoạn đường ven nước mát hơn mình tưởng. Có ai biết quán ăn sáng mở trước 7 giờ không?',
  'Mình vừa dọn lại bàn làm việc: giữ đúng một cuốn sổ, một cây bút và chai nước. Tập trung hơn hẳn.',
  'Cuối tuần này Hà Nội có triển lãm ảnh đường phố. Mình định đi chiều thứ bảy, ai muốn đi cùng?',
  'Lần đầu tự pha cà phê phin không bị quá đắng. Bí quyết là đừng nén bột quá chặt.',
  'Một thói quen nhỏ hiệu quả: tắt thông báo trong 45 phút đầu tiên khi bắt đầu làm việc.',
  'Hôm nay thử đi xe buýt thay vì xe máy. Chậm hơn 15 phút nhưng đọc được ba chương sách.',
  'Bữa tối đơn giản: canh rau ngót, trứng rán và cà muối. Món quen mà lâu rồi mới nấu.',
  'Vừa sửa một lỗi chỉ xuất hiện khi mạng chậm: nút gửi được bấm hai lần trước khi trạng thái loading cập nhật.',
  'Bài học hôm nay: đo thời gian truy vấn bằng dữ liệu thật trước khi thêm index theo cảm giác.',
  'Tài liệu API theo luồng sử dụng dễ theo dõi hơn một danh sách endpoint dài không có bối cảnh.',
  'Một pull request nhỏ có mô tả cách kiểm tra thường dễ review hơn một thay đổi lớn.',
  'Lỗi múi giờ trong lịch hẹn nhắc mình: lưu UTC, hiển thị theo múi giờ người dùng.',
  'Lớp hôm nay luyện nghe bằng bản tin hai phút. Các bạn nhớ ý chính tốt hơn khi không dịch từng từ.',
  'Viết nhật ký ba câu mỗi tối có vẻ đơn giản nhưng giúp học viên đặt câu tự nhiên hơn.',
  'Bài tập tuần này: kể lại một cuộc trò chuyện vui bằng năm câu đơn giản, không cần hoàn hảo.',
  'Cả lớp đóng vai hỏi đường ở ga tàu. Vui hơn nhiều so với chỉ đọc hội thoại trong sách.',
  'Ánh sáng sau cơn mưa ở Đà Nẵng đẹp quá. Mình mang máy ảnh ra đường đúng lúc trời vừa hửng.',
  'Chụp chân dung ngoài trời, mình thường tìm bóng râm trước rồi mới chọn phông nền.',
  'Cuối tuần muốn chụp chợ buổi sáng. Mình sẽ xin phép trước khi chụp cận cảnh người bán hàng.',
  'Thử in vài tấm ảnh cỡ nhỏ để tặng bạn. Cầm trên tay khác hẳn xem trên màn hình.',
  'Cây húng quế trên ban công cuối cùng cũng ra lá mới sau đợt nắng gắt.',
  'Hôm nay thử nấu đậu hũ sốt cà chua, thêm hành lá lúc tắt bếp là vừa thơm.',
  'Chậu sen đá từng héo vì tưới quá nhiều. Giờ mỗi tuần mình chỉ kiểm tra đất một lần.',
  'Trời mưa nên ở nhà làm bánh chuối. Mẻ sau giảm thời gian nướng năm phút thì vừa.',
  'Chạy 5 km đầu tiên sau một tuần nghỉ. Giữ nhịp chậm nên về nhà vẫn còn sức nấu bữa sáng.',
  'Mình bắt đầu ghi quãng đường theo tuần thay vì ám ảnh tốc độ từng buổi.',
  'Buổi chạy hôm nay dừng giữa chừng vì trời mưa lớn. Nghỉ đúng lúc cũng là một phần tập luyện.',
  'Mình đăng ký cự ly 21 km tháng sau, mục tiêu là hoàn thành khỏe mạnh.',
  'Chuyến tàu sáng đến Huế đúng giờ. Mình sẽ dành cả ngày đi bộ quanh khu trung tâm.',
  'Mẹo du lịch tự túc: lưu địa chỉ chỗ ở ngoại tuyến trước khi lên đường.',
  'Ăn bún cá ở một quán nhỏ gần chợ, cô chủ chỉ thêm một con đường tắt rất đẹp.',
  'Một chiếc bình nước đổ lại giúp giảm khá nhiều chai nhựa trong chuyến đi.',
  'Tối qua đọc tài liệu dự án mã nguồn mở nhỏ. Phần hướng dẫn đóng góp viết rất thân thiện.',
  'Một lỗi hỗ trợ tiếp cận được báo rõ bước tái hiện đã giúp nhóm mình sửa trong buổi chiều.',
  'Đừng quên thử ứng dụng khi mất mạng giữa lúc gửi biểu mẫu. Trường hợp này xảy ra thường hơn tưởng tượng.',
  'Mình vừa bật xác thực hai bước cho những tài khoản còn bỏ sót.',
  'Hôm nay phòng khám có một chú mèo mới nhận nuôi, rất nhát nhưng đã chịu ăn sau khi ngồi yên.',
  'Đổi thức ăn cho thú cưng nên làm từ từ để theo dõi phản ứng.',
  'Một chiếc hộp vận chuyển quen thuộc sẽ giúp mèo bớt căng thẳng khi đi khám.',
  'Đừng tự ý cho chó mèo dùng thuốc của người. Gọi bác sĩ thú y trước vẫn an toàn hơn.',
  'Hôm nay phác thảo nhân vật cho truyện thiếu nhi: một con cáo thích trồng rau trên mái nhà.',
  'Màu xanh rêu và cam đất đang là cặp màu mình dùng nhiều nhất trong sổ vẽ.',
  'Mình thử vẽ cùng một nhân vật ở năm cảm xúc khác nhau trước khi bắt đầu trang truyện mới.',
  'Hoàn thành storyboard sau ba lần sửa. Tự thưởng bằng một buổi chiều đi xem triển lãm.',
  'Mẻ bánh mì hôm nay nở đẹp nhờ để bột nghỉ lâu hơn 30 phút.',
  'Đi xe đạp qua công viên buổi sáng, mình thấy một lối đi mới nhiều bóng cây.',
  'Buổi phỏng vấn người dùng hôm nay cho thấy nhãn nút đang khiến mọi người hiểu nhầm.',
  'Tìm được một album nhạc indie hợp để nghe khi làm việc, giai điệu nhẹ vừa đủ.',
  'Mình mang hộp đựng khi mua đồ ăn trưa, quán gần nhà đã quen nên không thấy lạ nữa.',
  'Quán nhỏ trong hẻm vừa thêm cách thanh toán qua mã QR; bác chủ chỉ mất vài phút hướng dẫn.',
];

export function buildSeedData(now: Date) {
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const users = people.map(([username, displayName, bio], i) => ({
    id: id('user', i), email: `${username}@example.test`, username, displayName, bio,
    avatarUrl: i === 16 ? null : `https://i.pravatar.cc/150?img=${i + 1}`,
    bannerUrl: i % 3 === 0 ? 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200&q=80' : null,
    isActive: i !== 18, isEmailVerified: i !== 17, createdAt: ago(150 - i * 3),
  }));
  type Post = {
    id: string; authorId: string; content: string | null; visibility: Visibility;
    parentId: string | null; rootId: string | null; repostOfId: string | null;
    quotedPostId: string | null; isDeleted: boolean; editedAt: Date | null;
    likeCount: number; replyCount: number; repostCount: number; quoteCount: number;
    bookmarkCount: number; createdAt: Date;
  };
  const posts: Post[] = [];
  const addPost = (author: number, content: string | null, days: number, options: Partial<Post> = {}) => {
    const post: Post = { id: id('post', posts.length), authorId: users[author].id, content,
      visibility: 'PUBLIC', parentId: null, rootId: null, repostOfId: null,
      quotedPostId: null, isDeleted: false, editedAt: null, likeCount: 0,
      replyCount: 0, repostCount: 0, quoteCount: 0, bookmarkCount: 0,
      createdAt: ago(days), ...options };
    posts.push(post);
    return post;
  };
  stories.forEach((story, i) => {
    const author = Math.floor(i / 4) % 16;
    const visibility: Visibility = i % 17 === 0 ? 'FOLLOWERS' : i % 19 === 0 ? 'PRIVATE' : 'PUBLIC';
    addPost(author, story, 80 - i * 0.7, { visibility, editedAt: i % 23 === 1 ? ago(70 - i * 0.5) : null });
    addPost(author, `${story} Hôm nay quay lại chủ đề này, mình muốn nghe thêm trải nghiệm của mọi người.`, 40 - i * 0.35);
  });
  const first = posts[1];
  const reply = addPost(1, 'Mình hay ghé quán xôi ở đường Trích Sài, khoảng 6 giờ 30 đã mở.', 1,
    { parentId: first.id, rootId: first.id });
  addPost(0, 'Cảm ơn bạn, sáng mai mình thử ghé trước khi đi làm.', 0.9,
    { parentId: reply.id, rootId: first.id });
  for (let i = 0; i < 20; i++) {
    const parent = posts[(i * 7 + 2) % 90];
    const parentAuthor = users.findIndex((user) => user.id === parent.authorId);
    const replyAuthor = parent.visibility === 'PRIVATE' ? parentAuthor
      : parent.visibility === 'FOLLOWERS' ? (parentAuthor + 15) % 16 : (i + 4) % 16;
    addPost(replyAuthor, [
      'Mình cũng từng gặp trường hợp này. Cách bạn xử lý nghe rất hợp lý.',
      'Cảm ơn đã chia sẻ, mình lưu lại để thử vào cuối tuần.',
      'Góc nhìn thú vị quá. Bạn có thể kể thêm về trải nghiệm đó không?',
      'Mình đồng ý; thay đổi nhỏ nhưng hiệu quả thấy rõ sau vài ngày.',
    ][i % 4], 15 - i * 0.5,
    { parentId: parent.id, rootId: parent.id, visibility: parent.visibility });
  }
  const tombstone = addPost(3, null, 20, { isDeleted: true });
  addPost(4, 'Bài gốc đã được xóa nhưng phần thảo luận này vẫn còn.', 19,
    { parentId: tombstone.id, rootId: tombstone.id });
  for (let i = 0; i < 8; i++) {
    const original = posts[i * 10 + 2];
    addPost((i + 6) % 16, `Bài này gợi mình nghĩ thêm: ${[
      'một thói quen nhỏ dễ duy trì sẽ có ích lâu dài.',
      'ngữ cảnh thực tế luôn quan trọng hơn mẹo ngắn.',
      'mình muốn thử cách này rồi chia sẻ kết quả.',
      'câu chuyện của mỗi người có thêm một góc nhìn riêng.',
    ][i % 4]}`, 7 - i * 0.4, { quotedPostId: original.id });
    addPost((i + 9) % 16, null, 6 - i * 0.4, { repostOfId: original.id });
  }
  addPost(15, 'Mình cũng hay đi bộ đoạn đó lúc sáng sớm. Cảm ơn đã gợi ý quán ăn!', 0.5,
    { parentId: posts[0].id, rootId: posts[0].id, visibility: 'FOLLOWERS' });
  const media: Array<{ id: string; postId: string; publicId: string; url: string;
    type: MediaType; width: number; height: number; duration: number | null; order: number; createdAt: Date }> = [];
  const addMedia = (postIndex: number, url: string, type: MediaType, order = 0) => {
    const post = posts[postIndex];
    media.push({ id: id('media', media.length), postId: post.id,
      publicId: `seed/v1/posts/${post.id}/${order}`, url, type,
      width: type === 'IMAGE' ? 1200 : 640, height: type === 'IMAGE' ? 800 : 360,
      duration: type === 'VIDEO' ? 5.1 : null, order, createdAt: post.createdAt });
  };
  addMedia(32, 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&q=80', 'IMAGE');
  addMedia(32, 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=80', 'IMAGE', 1);
  addMedia(36, 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80', 'IMAGE');
  addMedia(62, 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1200&q=80', 'IMAGE');
  addMedia(70, 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'VIDEO');
  addMedia(90, 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80', 'IMAGE');
  posts[90].content = null;

  const follows: Array<{ followerId: string; followingId: string; createdAt: Date }> = [];
  for (let follower = 0; follower < 16; follower++) for (let step = 1; step <= 5; step++) {
    follows.push({ followerId: users[follower].id,
      followingId: users[(follower + step) % 16].id, createdAt: ago(60 - step * 4 - follower * 0.2) });
  }
  const likes: Array<{ userId: string; postId: string; createdAt: Date }> = [];
  const bookmarks: Array<{ userId: string; postId: string; createdAt: Date }> = [];
  for (let i = 0; i < 100; i++) {
    const post = posts[i];
    if (post.visibility !== 'PUBLIC') continue;
    for (let offset = 1; offset <= i % 5; offset++) {
      const viewer = (i + offset * 3) % 16;
      if (users[viewer].id !== post.authorId) likes.push({ userId: users[viewer].id,
        postId: post.id, createdAt: new Date(post.createdAt.getTime() + (1 + (i + offset) % 13) * 3_600_000) });
    }
    if (i % 2 === 0) bookmarks.push({ userId: users[(i + 7) % 16].id,
      postId: post.id, createdAt: ago(Math.max(0.1, 40 - i * 0.3)) });
  }
  for (const post of posts) {
    post.likeCount = likes.filter(x => x.postId === post.id).length;
    post.bookmarkCount = bookmarks.filter(x => x.postId === post.id).length;
    post.replyCount = posts.filter(x => x.parentId === post.id && !x.isDeleted).length;
    post.repostCount = posts.filter(x => x.repostOfId === post.id && !x.isDeleted).length;
    post.quoteCount = posts.filter(x => x.quotedPostId === post.id && !x.isDeleted).length;
  }
  const notifications: Array<{ id: string; recipientId: string; actorId: string;
    type: NotificationType; postId: string | null; isRead: boolean; createdAt: Date }> = [];
  const notify = (recipientId: string, actorId: string, type: NotificationType, postId: string | null, createdAt: Date) => {
    if (recipientId !== actorId) notifications.push({ id: id('notification', notifications.length),
      recipientId, actorId, type, postId, isRead: notifications.length % 3 === 0, createdAt });
  };
  const postById = new Map(posts.map(post => [post.id, post]));
  likes.slice(0, 45).forEach(x => notify(postById.get(x.postId)!.authorId, x.userId, 'LIKE', x.postId, x.createdAt));
  posts.filter(x => x.parentId).slice(0, 15).forEach(x => notify(postById.get(x.parentId!)!.authorId, x.authorId, 'REPLY', x.id, x.createdAt));
  posts.filter(x => x.quotedPostId).forEach(x => notify(postById.get(x.quotedPostId!)!.authorId, x.authorId, 'QUOTE', x.id, x.createdAt));
  posts.filter(x => x.repostOfId).forEach(x => notify(postById.get(x.repostOfId!)!.authorId, x.authorId, 'REPOST', x.repostOfId, x.createdAt));
  follows.slice(0, 25).forEach(x => notify(x.followingId, x.followerId, 'FOLLOW', null, x.createdAt));
  const sessions = [
    { id: id('session', 0), userId: users[0].id, tokenHash: hash('seed-invalid-refresh-token-0'),
      userAgent: 'Mozilla/5.0 (demo seed)', ipAddress: '192.0.2.10', isRevoked: true,
      expiresAt: ago(2), createdAt: ago(12) },
    { id: id('session', 1), userId: users[1].id, tokenHash: hash('seed-invalid-refresh-token-1'),
      userAgent: 'Mozilla/5.0 (demo seed)', ipAddress: '192.0.2.11', isRevoked: false,
      expiresAt: ago(1), createdAt: ago(8) },
  ];
  const otpCodes = [
    { id: id('otp', 0), userId: users[17].id, email: users[17].email,
      codeHash: hash('seed-expired-register-otp'), type: 'REGISTER_VERIFY', attempts: 0,
      expiresAt: ago(1), createdAt: ago(1.01) },
    { id: id('otp', 1), userId: users[1].id, email: users[1].email,
      codeHash: hash('seed-expired-reset-otp'), type: 'FORGOT_PASSWORD', attempts: 5,
      expiresAt: ago(2), createdAt: ago(2.01) },
  ];
  return { users, posts, media, follows, likes, bookmarks, notifications, sessions, otpCodes };
}
