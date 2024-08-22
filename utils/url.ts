import queryString from 'query-string';
import { PORT, NODE_ENV } from '../env/server-env';

export function getPublicUrl() {
    const returnable = "https://frames.vibra.so"
  return returnable
}

export function addActionLink(params: {
  name?: string;
  postUrl: `/${string}`;
}) {
  const { postUrl } = params;
  const qs = queryString.stringify(
    {
      url: `${getPublicUrl()}${postUrl}`,
    },
    {
      skipEmptyString: true,
      skipNull: true,
    },
  );

  const addActionLink = `https://warpcast.com/~/add-cast-action?${qs}`;
  console.log(addActionLink);
  return addActionLink;
}
