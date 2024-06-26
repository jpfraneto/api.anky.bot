
export interface Cast {
    object: string;
    hash: string;
    thread_hash: string;
    parent_hash: string | null;
    parent_url: string;
    root_parent_url: string;
    parent_author: {
      fid: number | null;
    };
    author: Author;
    text: string;
    timestamp: string;
    embeds: Embed[];
    frames: Frame[];
    reactions: Reactions;
    replies: {
      count: number;
    };
    mentioned_profiles: Author[];
    viewer_context: {
      liked: boolean;
      recasted: boolean;
    };
  }
  
  export interface Author {
    object: string;
    fid: number;
    custody_address: string;
    username: string;
    display_name: string;
    pfp_url: string;
    profile: {
      bio: {
        text: string;
      };
    };
    follower_count: number;
    following_count: number;
    verifications: string[];
    verified_addresses: {
      eth_addresses: string[];
      sol_addresses: string[];
    };
    active_status: string;
    power_badge: boolean;
    viewer_context: {
      following: boolean;
      followed_by: boolean;
    };
  }
  
  export interface Embed {
    url: string;
  }
  
  export interface Frame {
    version: string;
    title: string;
    image: string;
    image_aspect_ratio: string;
    buttons: Button[];
    input: Record<string, unknown>;
    state: Record<string, unknown>;
    post_url: string;
    frames_url: string;
  }
  
  export interface Button {
    index: number;
    title: string;
    action_type: string;
  }
  
  export interface Reactions {
    likes_count: number;
    recasts_count: number;
    likes: {
      fid: number;
      fname: string;
    }[];
    recasts: {
      fid: number;
      fname: string;
    }[];
  }
  
