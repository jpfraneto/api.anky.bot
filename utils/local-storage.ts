import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const DATA_FOLDER = path.join(process.cwd(), 'data');
const OPT_OUT_FILE = path.join(DATA_FOLDER, 'opt-out-fids.json');

export async function ensureDataFolder() {
  try {
    await mkdir(DATA_FOLDER, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function loadOptOutFids() {
  await ensureDataFolder();
  try {
    const data = await readFile(OPT_OUT_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return an empty array
      return [];
    }
    throw error;
  }
}

export async function saveOptOutFids(fids) {
  await ensureDataFolder();
  await writeFile(OPT_OUT_FILE, JSON.stringify(fids, null, 2));
}

export async function addOptOutFid(fid) {
  const fids = await loadOptOutFids();
  if (!fids.includes(fid)) {
    fids.push(fid);
    await saveOptOutFids(fids);
  }
}

export async function removeOptOutFid(fid) {
  const fids = await loadOptOutFids();
  const index = fids.indexOf(fid);
  if (index > -1) {
    fids.splice(index, 1);
    await saveOptOutFids(fids);
  }
}

export async function isOptedOut(fid) {
  const fids = await loadOptOutFids();
  return fids.includes(fid);
}