/** @jsxImportSource frog/jsx */
import { Frog, Button } from 'frog';
import { Logger } from '../../../utils/Logger';
import { colors } from '../../constants/colors';
import { StreamClient } from '@stream-io/node-sdk';
import { STREAM_API_KEY, STREAM_API_SECRET_KEY } from '../../../env/server-env';

export const app = new Frog({
  imageAspectRatio: '1:1',
  imageOptions: {
    width: 600,
    height: 600,
    fonts: [
      {
        name: 'Righteous',
        source: 'google',
      },
    ],
  },
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
});


const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET_KEY, { timeout: 3000 });

