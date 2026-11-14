export interface TestGroupFixture {
  groupId: string;
  groupName: string;
  unreadCount: number;
  lastSnippet: string;
  isInWhitelist: boolean;
  avatarUrl?: string;
  isCommunity?: boolean;
}

export const TEST_DISCOVERED_GROUPS: TestGroupFixture[] = [
  {
    groupId: 'g1206626154231863388',
    groupName: 'Nguồn BĐS Cầu Giấy',
    unreadCount: 3,
    lastSnippet: 'Bán nhà phân lô 4.5 tỷ',
    isInWhitelist: true,
    isCommunity: true,
  },
  {
    groupId: 'g9876543210987654321',
    groupName: 'Nguồn BĐS Đống Đa',
    unreadCount: 0,
    lastSnippet: 'Mặt phố Xã Đàn 12 tỷ',
    isInWhitelist: false,
    isCommunity: false,
  },
  {
    groupId: 'g5554443332221110000',
    groupName: 'Hội Môi Giới Hà Nội',
    unreadCount: 5,
    lastSnippet: 'Khách tìm nhà dưới 3 tỷ',
    isInWhitelist: true,
    isCommunity: true,
  },
];

export const TEST_FEATURE_FLAGS_DEFAULT = {
  'core-settings': true,
  'n01-sidebar-observer': true,
  'n02-queue-manager': true,
  'n03-chat-switcher': true,
  'n04-delta-stitcher': true,
  'n05-bundle-aggregator': true,
  'n06-dedup-gate': true,
  'n07-price-router': true,
  'n08-forward-automator': false,
  'n09-text-injector': false,
  'n10-committer-drain': true,
};

