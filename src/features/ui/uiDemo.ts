import type { Container } from 'pixi.js';
import { createUiAlert, createUiWindow } from '../../components/uiWindow';
import type { UiWindow } from '../../components/uiWindow';
import type { ScreenUiSystem } from '../../systems/screenUi';

type CreateUiDemoOptions = {
  screenUi: ScreenUiSystem;
};

/** Совпадает с размерами панели в `createUiWindow` (после snap в uiWindow — кратно 64). */
const DEMO_CONFIRM_PANEL_WIDTH = 384;
const DEMO_CONFIRM_PANEL_HEIGHT = 256;

const DEMO_WINDOW_MESSAGE = [
  'Это screen-space окно не зависит от камеры и не двигается при pan/zoom мира.',
  'Временные кнопки уже имеют состояния наведения, нажатия и отжатия.',
  'Позже сюда можно подключить спрайты X/V, scroll-кнопки и покадровые анимации.',
  'Текст прокручивается простыми кнопками вверх и вниз внутри окна.',
  'Этот слой живет поверх игрового мира и подходит для меню, подтверждений и уведомлений.',
  'Финальные ассеты можно будет заменить без изменения внешнего API окна.',
].join(' ');

/** Текст для углового алерта (не дублирует описание confirm-меню). */
const DEMO_ALERT_MESSAGE = [
  'Входящее уведомление: мир на паузе не стоит — это краткая сводка поверх игры.',
  'Обычно здесь награда, сообщение другого игрока, статус доставки или системное предупреждение.',
  'Закройте окно крестиком. Длинный текст прокручивается стрелками справа, колесом мыши или перетаскиванием.',
  'Повторные уведомления можно ставить в очередь или группировать — зависит от вашей игровой логики.',
].join(' ');

function hideContainer(container: Container): void {
  container.visible = false;
}

export async function createUiDemo(
  options: CreateUiDemoOptions,
): Promise<void> {
  let confirmWindow: UiWindow;

  confirmWindow = await createUiWindow({
    title: 'Confirm Menu',
    message: DEMO_WINDOW_MESSAGE,
    iconName: 'scroll',
    width: DEMO_CONFIRM_PANEL_WIDTH,
    height: DEMO_CONFIRM_PANEL_HEIGHT,
    onClose: () => hideContainer(confirmWindow),
    onCancel: () => hideContainer(confirmWindow),
    onConfirm: () => hideContainer(confirmWindow),
  });
  const alert = await createUiAlert({
    title: 'Incoming Alert',
    message: DEMO_ALERT_MESSAGE,
    iconName: 'gemBlue',
    width: DEMO_CONFIRM_PANEL_WIDTH,
    height: DEMO_CONFIRM_PANEL_HEIGHT,
    messageFontSize: 18,
    onClose: () => hideContainer(alert),
  });

  confirmWindow.setMessage(DEMO_WINDOW_MESSAGE);

  options.screenUi.modalLayer.addChild(confirmWindow);
  options.screenUi.alertLayer.addChild(alert);

  options.screenUi.addLayoutHandler(
    ({ width, height, edgeInsetX, edgeInsetY }) => {
      confirmWindow.position.set(
        Math.round((width - DEMO_CONFIRM_PANEL_WIDTH) / 2),
        Math.round((height - DEMO_CONFIRM_PANEL_HEIGHT) / 2),
      );

      const aw = alert.width;
      const ah = alert.height;
      alert.position.set(
        Math.round(width - aw - edgeInsetX),
        Math.round(height - ah - edgeInsetY),
      );
    },
  );
}
