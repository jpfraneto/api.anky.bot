type Hash = string;
type EthAddress = string;
type SolAddress = string;
type FID = number | null;
type Timestamp = string;

type Profile = {
  bio: Bio;
  mentioned_profiles: any[];
};

type Bio = {
  text: string;
  mentioned_profiles: any[];
};

type User = {
  object: 'user';
  fid: number;
  custody_address: EthAddress;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: Profile;
  follower_count: number;
  following_count: number;
  verifications: EthAddress[];
  verified_addresses: {
    eth_addresses: EthAddress[];
    sol_addresses: SolAddress[];
  };
  active_status: 'active' | 'inactive';
  power_badge: boolean;
  viewer_context: {
    following: boolean;
    followed_by: boolean;
  };
};

type Reaction = {
  fid: number;
  fname: string;
};

type Reactions = {
  likes_count: number;
  recasts_count: number;
  likes: Reaction[];
  recasts: Reaction[];
};

type Replies = {
  count: number;
};

type Cast = {
  object: 'cast';
  hash: Hash;
  thread_hash: Hash;
  parent_hash: Hash | null;
  parent_url: string | null;
  root_parent_url: string;
  parent_author: {
    fid: FID;
  };
  author: User;
  text: string;
  timestamp: Timestamp;
  embeds: any[];
  reactions: Reactions;
  replies: Replies;
  mentioned_profiles: any[];
  direct_replies: Cast[];
};

type Conversation = {
  cast: Cast;
};

export type ConversationJSON = {
  conversation: Conversation;
};
