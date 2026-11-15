const DEDICATED_PORTRAITS: Record<string, string> = {
  'Trần Quang Minh': '/images/people/person-01.jpg',
  'Nguyễn Hải Đăng': '/images/people/person-02.jpg',
  'Nguyễn Văn Tuấn': '/images/people/person-03.jpg',
  'Lê Hoàng Nam': '/images/people/person-04.jpg',
  'Phạm Quốc Trung': '/images/people/person-05.jpg',
  'Vũ Thành Long': '/images/people/person-06.jpg',
  'BS. Phạm Minh Trí': '/images/people/person-07.jpg',
  'BS. Nguyễn Thảo Vy': '/images/people/person-08.jpg',
  'BS. Trần Đình Khôi': '/images/people/person-09.jpg',
  'BS. Lê Phương Anh': '/images/people/person-10.jpg',
  'Phạm Gia Bảo': '/images/people/person-11.jpg',
  'Đặng Hoàng Yến': '/images/people/person-12.jpg',
  'Vũ Quốc Hưng': '/images/people/person-13.jpg',
  'Trịnh Bích Ngọc': '/images/people/person-14.jpg',
  'Lương Minh Đức': '/images/people/person-15.jpg',
  'Tống Khánh Linh': '/images/people/person-16.jpg',
  'Ngô Minh Châu': '/images/people/person-17.jpg',
  'Trương Quốc Khánh': '/images/people/person-18.jpg',
  'BS. Đặng Hải Lâm': '/images/people/person-19.jpg',
  'Huỳnh Tấn Phát': '/images/people/person-20.jpg',
  'Dương Quang Vinh': '/images/people/person-21.jpg',
  'Đạt Thành Trần Bùi': '/images/people/person-22.jpg',
  'Tài khoản bị khóa kiểm thử': '/images/people/person-23.jpg',
};

const TOTAL_PORTRAITS = 25;

export function resolvePersonAvatar(name: string, avatarUrl?: string | null): string {
  if (avatarUrl) return avatarUrl;
  const trimmed = name?.trim() || '';
  if (DEDICATED_PORTRAITS[trimmed]) {
    return DEDICATED_PORTRAITS[trimmed];
  }
  const index = (Array.from(trimmed).reduce((sum, character) => sum + character.codePointAt(0)!, 0) % TOTAL_PORTRAITS) + 1;
  return `/images/people/person-${String(index).padStart(2, '0')}.jpg`;
}
