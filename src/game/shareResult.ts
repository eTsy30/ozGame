import type { GameSnapshot } from './types';
import { formatEarnedMoney } from './gameConfig';

function formatGoods(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} товаров`;
  if (last === 1) return `${count} товар`;
  if (last >= 2 && last <= 4) return `${count} товара`;

  return `${count} товаров`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

async function createResultImage(snapshot: GameSnapshot) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Не удалось создать изображение');
  }

  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#EAF3FF');
  gradient.addColorStop(1, '#C9DFFF');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  roundedRect(ctx, 42, 35, 1116, 560, 28, '#FFFFFF');
  roundedRect(ctx, 42, 35, 1116, 145, 28, '#005BFF');

  ctx.fillStyle = '#005BFF';
  ctx.fillRect(42, 125, 1116, 55);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('КОРОБОЧНЫЙ ПЕРЕПОЛОХ', 80, 105);

  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#DCEAFF';
  ctx.fillText('МОЯ СМЕНА ЗАВЕРШЕНА', 80, 153);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6684AD';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('ДОСТАВЛЕНО', 600, 252);

  ctx.fillStyle = '#123B73';
  ctx.font = 'bold 90px monospace';
  ctx.fillText(String(snapshot.delivered), 600, 355);

  ctx.fillStyle = '#005BFF';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(formatGoods(snapshot.delivered), 600, 390);

  roundedRect(ctx, 100, 430, 455, 115, 16, '#EFF6FF');
  roundedRect(ctx, 645, 430, 455, 115, 16, '#FFF6E2');

  ctx.fillStyle = '#6684AD';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('МОЙ ЗАРАБОТОК', 327, 466);

  ctx.fillStyle = '#123B73';
  ctx.font = 'bold 32px monospace';
  ctx.fillText(formatEarnedMoney(snapshot.earnedKopecks), 327, 515);

  ctx.fillStyle = '#A57B2D';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('ЛУЧШИЙ РЕЗУЛЬТАТ', 872, 466);

  ctx.fillStyle = '#A56B00';
  ctx.font = 'bold 32px monospace';
  ctx.fillText(formatGoods(snapshot.best), 872, 515);

  ctx.fillStyle = '#718AAB';
  ctx.font = 'bold 15px Arial';
  ctx.fillText(`ДОСТИГНУТ УРОВЕНЬ ${snapshot.level}`, 600, 574);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Не удалось подготовить PNG'));
      }
    }, 'image/png');
  });

  return new File(
    [blob],
    'korobochny-rezultat.png',
    { type: 'image/png' },
  );
}



export async function shareGameResult(this: any, snapshot: GameSnapshot) {
  const shareText =
    `В игре «Коробочный переполох» я доставил ${formatGoods(snapshot.delivered)}! ` +
    `Заработано: ${formatMoney(this.earnedKopecks)}` +
    `Мой рекорд: ${formatGoods(snapshot.best)}.`;

  let canShareImage = false;

  try {
    const testFile = new File(['test'], 'test.png', {
      type: 'image/png',
    });

    canShareImage =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [testFile] });
  } catch {
    canShareImage = false;
  }

  const telegramWindow = canShareImage
    ? null
    : window.open('about:blank', '_blank');

  try {
    const image = await createResultImage(snapshot);

    if (canShareImage) {
      await navigator.share({
        files: [image],
        title: 'Мой результат',
        text: shareText,
      });

      return;
    }

    const imageUrl = URL.createObjectURL(image);
    const link = document.createElement('a');

    link.href = imageUrl;
    link.download = image.name;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(imageUrl);
    }, 1000);

    const telegramUrl = new URL('https://t.me/share/url');

    telegramUrl.searchParams.set('url', window.location.href);
    telegramUrl.searchParams.set(
      'text',
      `${shareText}\nКартинка результата скачана — прикрепи её к сообщению.`,
    );

    if (telegramWindow) {
      telegramWindow.location.href = telegramUrl.toString();
    }
  } catch (error) {
    telegramWindow?.close();
    throw error;
  }
}
function formatMoney(kopecks: number): string {
  const rubles = Math.floor(kopecks / 100);
  const cents = kopecks % 100;

  const rublesWord =
    rubles % 10 === 1 && rubles % 100 !== 11
      ? 'рубль'
      : rubles % 10 >= 2 &&
          rubles % 10 <= 4 &&
          (rubles % 100 < 12 || rubles % 100 > 14)
        ? 'рубля'
        : 'рублей';

  return `${rubles} ${rublesWord} ${cents} копеек`;
}