import { getJoinUrl } from './ws';

export type ShareInviteResult = 'shared' | 'copied' | 'cancelled' | 'failed';

async function copyTextFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea copy
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function copyRoomInvite(roomCode: string, lang: 'en' | 'zh'): Promise<boolean> {
  return copyTextFallback(getJoinUrl(roomCode, lang));
}

export async function shareRoomInvite(options: {
  roomCode: string;
  lang: 'en' | 'zh';
  gameName?: string;
}): Promise<ShareInviteResult> {
  const code = options.roomCode.trim().toUpperCase();
  const url = getJoinUrl(code, options.lang);
  const title =
    options.lang === 'zh'
      ? `加入 JoinStick 街机房间 ${code}`
      : `Join JoinStick Arcade Room ${code}`;
  const text =
    options.lang === 'zh'
      ? options.gameName
        ? `来一起玩「${options.gameName}」！房间码：${code}，点击链接直接加入：`
        : `快来加入我的 JoinStick 联机房间！房间码：${code}，点击链接直接加入：`
      : options.gameName
      ? `Play ${options.gameName} with me! Room code: ${code} — tap to join:`
      : `Join my JoinStick Arcade room (${code})! Tap to jump in:`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard copy if share is blocked (e.g. iframe or desktop policy)
    }
  }

  const copied = await copyTextFallback(url);
  return copied ? 'copied' : 'failed';
}
