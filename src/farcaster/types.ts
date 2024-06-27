export interface Cast {
    hash: string;
    text: string;
    author: {
      fid: number;
      username: string;
    };
    timestamp: string;
    parentHash?: string;
  }