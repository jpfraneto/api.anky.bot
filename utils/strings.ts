export function abbreviateAddress(str: string, length = 6) {
    return str.slice(0, length) + '...' + str.slice(-length);
  }