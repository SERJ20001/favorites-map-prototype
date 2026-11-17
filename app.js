import {
  products,
  addresses,
  money,
  distance,
  distanceText,
  walkMinutes,
} from "./data.js";
import { NeighborhoodMap } from "./map.js";

const app = document.querySelector("#app");
const icons = {
  back: "184c1.svg",
  down: "d82ac.svg",
  close: "5b9eb.svg",
  closeDark: "30170.svg",
  plus: "85776.svg",
  minus: "5d8de.svg",
  locate: "babb2.svg",
  heart: "aab45.svg",
  chat: "6c8c1.svg",
  cart: "e8614.svg",
  favorites: "43a02.svg",
  search: "7e58a.svg",
  ads: "770bd.svg",
  messages: "a2cde.svg",
  profile: "e9042.svg",
  check: "0c1b7.svg",
  right: "17d0d.svg",
};
const icon = (name) => `<img class="icon" src="assets/${icons[name]}" alt="">`;
const artwork = (size, error = false) =>
  `<span class="${size}-art" aria-hidden="true"><img class="art-map" src="assets/${error ? "f6e2e.png" : "f5dec.png"}" alt=""><span class="art-pin">${Array.from({ length: 4 }, () => `<img src="assets/${error ? "9426b.png" : "b75ec.png"}" alt="">`).join("")}</span><img class="art-heart" src="assets/${error ? "1c423.svg" : size === "geo" ? "d3af9.svg" : "57eef.svg"}" alt=""></span>`;
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const state = {
  view: "favorites",
  overlay: null,
  selected: null,
  located: false,
  origin: { ...addresses[0] },
  radius: 500,
  category: "Все",
  sort: "recent",
  banner: true,
  favorites: products.map((product) => product.id),
  cart: [],
  messages: {},
  picking: false,
  route: null,
  status: "ready",
};
let map;
let loadingTimer;
let toastTimer;
let focusBeforeOverlay;

const selectedProduct = () =>
  products.find((product) => product.id === state.selected);
const favoriteProducts = () =>
  products.filter((product) => state.favorites.includes(product.id));
const nearbyProducts = () =>
  favoriteProducts().filter(
    (product) => distance(product, state.origin) <= state.radius,
  );
const routeState = () => ({
  view: state.view,
  overlay: state.overlay,
  selected: state.selected,
  picking: state.picking,
  route: state.route,
});

function navigate(patch, replace = false) {
  Object.assign(state, patch);
  history[replace ? "replaceState" : "pushState"](
    routeState(),
    "",
    location.href.split("#")[0],
  );
  render();
}

function close() {
  if (state.overlay === "geo" || state.overlay === "error") {
    navigate({ view: "favorites", overlay: null }, true);
    return;
  }
  if (state.overlay === "address" && !state.located) {
    navigate({ overlay: "geo" }, true);
    return;
  }
  if (
    ["pickup", "delivery", "chat", "seller", "photo"].includes(state.overlay) &&
    state.selected
  ) {
    navigate({ overlay: "product", route: null }, true);
    return;
  }
  if (state.overlay || state.picking || state.route) {
    navigate({ overlay: null, picking: false, route: null }, true);
  } else if (state.view === "map") navigate({ view: "favorites" }, true);
  else navigate({ overlay: "menu" });
}

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 2600);
}

function itemCard(product) {
  const favorite = state.favorites.includes(product.id);
  return `<article class="favorite-card" data-id="${product.id}">
    <button class="product-photo" data-action="product" data-id="${product.id}" aria-label="Открыть: ${product.title}"><img src="assets/${product.image}" alt="${product.title}"></button>
    <div class="favorite-content"><button class="product-info" data-action="product" data-id="${product.id}"><strong>${money(product.price)}</strong>${product.old ? `<span class="old-price"><s>${money(product.old)}</s> <em>−${Math.round((1 - product.price / product.old) * 100)}%</em></span>` : ""}<span class="product-title">${product.short}</span><span class="muted">Чкаловская<br>Санкт-Петербург, ${product.address}<br>${product.date}</span></button>
    <button class="cart-chip" data-action="cart-add" data-id="${product.id}">${state.cart.includes(product.id) ? "В корзине" : "В корзину"}</button></div>
    <button class="favorite-toggle ${favorite ? "" : "off"}" data-action="favorite" data-id="${product.id}" aria-label="${favorite ? "Убрать из избранного" : "В избранное"}: ${product.title}" aria-pressed="${favorite}">${icon("heart")}</button>
  </article>`;
}

function renderFavorites() {
  const categories = ["Все", "Посуда", "Одежда", "Для дома", "Спорт"];
  let list = favoriteProducts().filter(
    (product) =>
      state.category === "Все" || product.category === state.category,
  );
  if (state.sort === "price")
    list = [...list].sort((a, b) => a.price - b.price);
  if (state.sort === "near")
    list = [...list].sort(
      (a, b) => distance(a, state.origin) - distance(b, state.origin),
    );
  document.querySelector("#favorites").innerHTML =
    `<header class="favorites-header"><div class="status-bar"><img src="assets/16c6d.svg" alt="9:41"></div><div class="favorites-title"><h1>Избранное</h1><button class="icon-button cart-button" data-action="cart" aria-label="Корзина">${icon("cart")}${state.cart.length ? `<span class="counter">${state.cart.length}</span>` : ""}</button><button class="icon-button menu-button" data-action="menu" aria-label="Меню избранного"><span class="ellipsis">•••</span></button></div><nav class="favorite-tabs" aria-label="Разделы избранного"><button class="active">Объявления</button><button data-action="collections">Подборки</button><button data-action="searches">Поиски</button><button data-action="compare">Сравнение</button></nav></header>
    <div class="favorites-scroll"><div class="category-tabs">${categories.map((category) => `<button class="${state.category === category ? "active" : ""}" data-action="category" data-category="${category}">${category} ${favoriteProducts().filter((product) => category === "Все" || product.category === category).length}</button>`).join("")}</div><div class="sort-row"><button data-action="sort"><span class="sort-symbol">↕</span> ${state.sort === "price" ? "Сначала дешевле" : state.sort === "near" ? "Сначала ближайшее" : "Сначала недавнее"}</button>${!state.banner ? '<button class="map-entry" data-action="map">На карте</button>' : ""}</div>
    ${state.banner ? `<div class="map-banner"><button class="banner-main" data-action="map">${artwork("banner")}<span><b>Товары избранного на карте</b><span>Выбирайте самые ближайшие<br>и забирайте по пути</span></span></button><button class="banner-close" data-action="banner-close" aria-label="Закрыть баннер">${icon("closeDark")}</button></div>` : ""}
    <div class="favorite-list">${list.length ? list.map(itemCard).join("") : '<div class="empty-list"><h2>Пока ничего нет</h2><p>Добавляйте понравившиеся товары в избранное — они появятся здесь.</p><button class="primary" data-action="reset-favorites">Вернуть товары</button></div>'}</div></div>
    <nav class="bottom-tabs" aria-label="Основная навигация">${[
      ["search", "Поиск"],
      ["favorites", "Избранное"],
      ["ads", "Объявления"],
      ["messages", "Сообщения"],
      ["profile", "Профиль"],
    ]
      .map(
        ([name, label]) =>
          `<button class="${name === "favorites" ? "active" : ""}" data-action="${name === "favorites" ? "favorites" : `nav-${name}`}">${icon(name)}<span>${label}</span></button>`,
      )
      .join("")}</nav>`;
}

function renderMap() {
  const items =
    state.located && state.status === "ready" ? nearbyProducts() : [];
  map.setItems(
    items,
    { ...state.origin, visible: state.located },
    state.selected,
  );
  map.pick = state.picking;
  map.route = state.route ? selectedProduct() : null;
  document.querySelector("#address-title").textContent = state.located
    ? state.origin.title
    : "Адрес не выбран";
  document.querySelector("#map-controls").hidden = Boolean(
    state.overlay === "product" ||
    state.route ||
    state.picking ||
    !state.located,
  );
  document.querySelector("#radius-controls").innerHTML = [500, 1000, 5000]
    .map(
      (radius) =>
        `<button class="${state.radius === radius ? "active" : ""}" data-action="radius" data-radius="${radius}" aria-pressed="${state.radius === radius}">${radius === 500 ? "до 500 метров" : radius === 1000 ? "до 1 км." : "до 5 км."}</button>`,
    )
    .join("");
  document.querySelector("#map-hints").innerHTML =
    state.status === "loading"
      ? `<div class="loading-pill">Загружаем избранное рядом…</div><div class="skeleton-pin one"></div><div class="skeleton-pin two"></div><div class="skeleton-pin three"></div>`
      : state.picking
        ? `<div class="floating-card pick-card"><b>Укажите точку на карте</b><p>Переместите карту и нажмите на нужное место.</p><button class="secondary" data-action="pick-center">Выбрать центр карты</button><button class="text-button" data-action="close">Отмена</button></div><div class="center-crosshair"></div>`
        : state.located && !items.length && state.status === "ready"
          ? `<div class="floating-card"><h2>В ${distanceText(state.radius)} ничего нет</h2><p>${favoriteProducts().length ? `Ближайший товар из избранного — в ${distanceText(Math.min(...favoriteProducts().map((product) => distance(product, state.origin))))} от вас.` : "Добавьте товары в избранное, чтобы увидеть их на карте."}</p><button class="primary" data-action="nearest">Показать ближайшие</button></div>`
          : "";
  document.querySelector("#route-panel").innerHTML = state.route
    ? routePanel()
    : "";
}

function routePanel() {
  const product = selectedProduct();
  const meters = distance(product, state.origin);
  return `<section class="route-card"><button class="round-close" data-action="close" aria-label="Закрыть маршрут">${icon("closeDark")}</button><p class="eyebrow">Пешком до продавца</p><h2>${walkMinutes(meters)} мин · ${distanceText(meters)}</h2><p>${product.address}</p><div class="route-product"><img src="assets/${product.image}" alt=""><div><b>${product.title}</b><span>${money(product.price)} · ${product.seller}</span></div></div><button class="primary" data-action="chat">Написать продавцу</button></section>`;
}

function productPanel() {
  const product = selectedProduct();
  const meters = distance(product, state.origin);
  const photos = product.photos || [product.image];
  return `<div class="distance-pill">${distanceText(meters)} · ${walkMinutes(meters)} мин пешком</div><section class="product-sheet" role="dialog" aria-modal="true" aria-label="${product.title}"><button class="detail-close" data-action="close" aria-label="Закрыть карточку">${icon("close")}</button><div class="product-scroll"><div class="photo-gallery" tabindex="0" aria-label="Фотографии товара">${photos.map((photo, index) => `<button data-action="photo" data-index="${index}" aria-label="Увеличить фото ${index + 1}"><img src="assets/${photo}" alt="${product.title}, фото ${index + 1}"></button>`).join("")}<span class="photo-count">1 из ${photos.length}</span></div><div class="detail-main"><h2 class="detail-price">${money(product.price)}</h2>${product.old ? `<div class="detail-old"><s>${money(product.old)}</s><em>−${Math.round((1 - product.price / product.old) * 100)}%</em></div>` : ""}${product.sold ? '<div class="sold-notice"><b>Товар снят с продажи</b><p>Продавец уже продал его. Посмотрите другие товары рядом.</p></div>' : `<div class="detail-badges"><button data-action="delivery">От 130 ₽, от 1 дня</button><span>Можно проверить</span><span>${product.rating} · ${product.reviews} отзывов</span><button data-action="seller">Продавец</button></div>`}<h3>${product.title}</h3><p class="detail-subtitle">${product.sold ? "Объявление больше не активно" : "В наличии: 1 · можно забрать сегодня"}</p><section class="detail-section"><h3>Характеристики</h3><dl>${Object.entries(
    product.specs,
  )
    .map(([key, value]) => `<div><dt>${key}:</dt><dd>${value}</dd></div>`)
    .join(
      "",
    )}</dl></section><section class="detail-section"><h3>Описание</h3><p>${product.description}</p></section><section class="detail-section"><h3>Местоположение</h3><p>Санкт-Петербург, ${product.address}</p><p class="muted">${distanceText(meters)} от выбранной точки · ${walkMinutes(meters)} мин пешком</p><button class="secondary" data-action="route" ${product.sold ? "disabled" : ""}>Построить маршрут</button></section><button class="seller-card" data-action="seller"><span class="avatar">${product.seller[0]}</span><span><b>${product.seller}</b><span>${product.rating} · ${product.reviews} отзывов<br>Частный продавец · на Авито с 2020 года</span></span>${icon("right")}</button><button class="text-button" data-action="favorite" data-id="${product.id}">${state.favorites.includes(product.id) ? "Убрать из избранного" : "Добавить в избранное"}</button></div></div><footer class="product-actions">${product.sold ? '<button class="primary wide" data-action="other-products">Другие товары рядом</button>' : `<button class="primary" data-action="pickup">Самовывоз</button><button class="secondary" data-action="delivery">Доставкой</button><button class="secondary chat-button" data-action="chat" aria-label="Написать продавцу">${icon("chat")}</button>`}</footer></section>`;
}

function onboarding(error = false) {
  return `<section class="onboarding ${error ? "network-onboarding" : ""}" role="dialog" aria-modal="true" aria-label="${error ? "Ошибка сети" : "Геопозиция"}">${artwork("geo", error)}<div class="onboarding-copy"><h2>${error ? "Не удалось загрузить товары" : "Покажем избранное рядом с вами"}</h2><p>${error ? "Проверьте соединение, а мы попробуем разобраться, что не так." : "Разрешите доступ к геопозиции или укажите адрес вручную — отсчитаем расстояние от него."}</p><button class="${error ? "secondary" : "primary"}" data-action="${error ? "retry-map" : "allow-location"}">${error ? "Повторить" : "Разрешить доступ"}</button>${error ? "" : '<button class="secondary" data-action="address">Указать адрес</button>'}</div></section>`;
}

function addressPanel() {
  return `<div class="scrim" data-action="close"></div><section class="sheet address-sheet" role="dialog" aria-modal="true" aria-label="Откуда искать товары"><div class="sheet-handle"></div><div id="address-results">${addressResults("")}</div><form id="address-form"><div class="address-input"><input id="address-input" type="search" autocomplete="off" placeholder="Введите адрес" aria-label="Введите адрес"><button class="icon-button" type="submit" aria-label="Применить адрес">${icon("check")}</button></div></form><div class="address-actions"><button class="text-button" data-action="pick-location">Указать точку на карте</button><button class="text-button" data-action="allow-location">Моё местоположение</button></div></section>`;
}

function addressResults(query) {
  const words = query
    .toLowerCase()
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const matches = addresses
    .map((address, index) => ({ ...address, index }))
    .filter((address) =>
      words.every((word) =>
        `${address.title} ${address.subtitle}`.toLowerCase().includes(word),
      ),
    );
  return matches.length
    ? matches
        .map(
          (address) =>
            `<button class="address-result" data-action="choose-address" data-index="${address.index}"><b>${address.title}</b><span>${address.subtitle}</span></button>`,
        )
        .join("")
    : '<p class="address-empty">Этот адрес не найден. Попробуйте «Радищева, 12» или укажите точку на карте.</p>';
}

function sheet(title, body, className = "") {
  return `<div class="scrim" data-action="close"></div><section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${title}"><div class="sheet-handle"></div><button class="round-close" data-action="close" aria-label="Закрыть">${icon("closeDark")}</button><div class="sheet-scroll"><h2>${title}</h2>${body}</div></section>`;
}

function renderOverlay() {
  const host = document.querySelector("#overlay");
  let html = "";
  const product = selectedProduct();
  switch (state.overlay) {
    case "geo":
      html = onboarding();
      break;
    case "error":
      html = onboarding(true);
      break;
    case "address":
      html = addressPanel();
      break;
    case "product":
      html = productPanel();
      break;
    case "pickup":
      html = sheet(
        "Забрать у продавца",
        `<div class="compact-product"><img src="assets/${product.image}" alt=""><div><b>${product.title}</b><p>${money(product.price)}</p></div></div><p>${product.seller} · ${product.address}</p><p class="muted">Перед встречей договоритесь с продавцом о времени. Товар можно осмотреть на месте.</p><button class="primary wide" data-action="route">Построить маршрут</button><button class="secondary wide" data-action="chat">Договориться о встрече</button><button class="text-button" data-action="back-product">Вернуться к товару</button>`,
      );
      break;
    case "delivery":
      html = sheet(
        "Доставка Авито",
        `<div class="compact-product"><img src="assets/${product.image}" alt=""><div><b>${product.title}</b><p>${money(product.price)}</p></div></div><p>В пункт выдачи · от 1 дня</p><div class="delivery-row"><span>Товар</span><b>${money(product.price)}</b></div><div class="delivery-row"><span>Доставка</span><b>130 ₽</b></div><div class="delivery-row total"><span>Итого</span><b>${money(product.price + 130)}</b></div><p class="muted">Наличие и удобный пункт выдачи можно обсудить с продавцом.</p><button class="primary wide" data-action="chat">Обсудить доставку</button><button class="text-button" data-action="back-product">Вернуться к товару</button>`,
      );
      break;
    case "chat":
      html = sheet(
        product.seller,
        `<div class="compact-product"><img src="assets/${product.image}" alt=""><div><b>${product.title}</b><p>${money(product.price)}</p></div></div><p class="chat-date">Сегодня</p><div class="chat-messages"><div class="message incoming">Здравствуйте! ${product.sold ? "Этот товар уже продан." : "Товар в наличии. Можно посмотреть и забрать сегодня — напишите, когда вам удобно."}</div>${(state.messages[product.id] || []).map((message) => `<div class="message outgoing">${escapeHtml(message)}</div>`).join("")}</div><form id="message-form" class="message-form"><input name="message" placeholder="Напишите сообщение" aria-label="Сообщение продавцу" maxlength="1000" required><button class="primary" type="submit">Отправить</button></form><p class="chat-caption">Переписка в прототипе</p><button class="text-button" data-action="back-product">Вернуться к товару</button>`,
        "chat-sheet",
      );
      break;
    case "seller":
      html = sheet(
        product.seller,
        `<div class="seller-summary"><span class="avatar">${product.seller[0]}</span><div><b>${product.rating} · ${product.reviews} отзывов</b><p>Частный продавец<br>На Авито с 2020 года</p></div></div><h3>О продавце</h3><p>Отвечает в течение часа. Встреча по предварительной договорённости, товары можно проверить перед покупкой.</p><p class="muted">Санкт-Петербург, ${product.address}</p><button class="primary wide" data-action="chat">Написать</button><button class="text-button" data-action="back-product">Вернуться к товару</button>`,
      );
      break;
    case "photo":
      html = `<section class="photo-viewer" role="dialog" aria-modal="true" aria-label="Фотографии товара"><button class="detail-close" data-action="back-product" aria-label="Закрыть фотографии">${icon("close")}</button><div class="full-photos">${(product.photos || [product.image]).map((photo) => `<img src="assets/${photo}" alt="${product.title}">`).join("")}</div><p>Листайте фотографии</p></section>`;
      break;
    case "sort":
      html = sheet(
        "Сортировка",
        [
          ["recent", "Сначала недавнее"],
          ["price", "Сначала дешевле"],
          ["near", "Сначала ближайшее"],
        ]
          .map(
            ([value, text]) =>
              `<button class="option" data-action="choose-sort" data-value="${value}">${text}<span class="radio ${state.sort === value ? "checked" : ""}"></span></button>`,
          )
          .join(""),
      );
      break;
    case "cart":
      html = sheet(
        "Корзина",
        state.cart.length
          ? `<div class="cart-list">${products
              .filter((item) => state.cart.includes(item.id))
              .map(
                (item) =>
                  `<div class="compact-product"><button data-action="product" data-id="${item.id}"><img src="assets/${item.image}" alt="${item.title}"></button><div><b>${item.title}</b><p>${money(item.price)}</p><button class="text-button" data-action="cart-remove" data-id="${item.id}">Удалить</button></div></div>`,
              )
              .join(
                "",
              )}</div><div class="delivery-row total"><span>Товары на сумму</span><b>${money(products.filter((item) => state.cart.includes(item.id)).reduce((sum, item) => sum + item.price, 0))}</b></div><button class="primary wide" data-action="map">Посмотреть на карте</button>`
          : '<p>В корзине пока нет товаров. Добавьте их из избранного.</p><button class="primary wide" data-action="close">К избранному</button>',
      );
      break;
    case "collections":
      html = sheet(
        "Мои подборки",
        ["Для дома", "Одежда", "Спорт", "Посуда"]
          .map(
            (category) =>
              `<button class="collection-row" data-action="collection" data-category="${category}"><b>${category}</b><span>${favoriteProducts().filter((item) => item.category === category).length} товара</span>${icon("right")}</button>`,
          )
          .join(""),
      );
      break;
    case "searches":
      html = sheet(
        "Сохранённые поиски",
        '<p>Быстрый доступ к вещам, которые вы ищете.</p><button class="collection-row" data-action="collection" data-category="Для дома"><b>Лампы и мебель для дома</b><span>Санкт-Петербург</span></button><button class="collection-row" data-action="collection" data-category="Спорт"><b>Рюкзаки до 5 000 ₽</b><span>Санкт-Петербург</span></button>',
      );
      break;
    case "compare":
      html = sheet(
        "Сравнение рюкзаков",
        `<div class="compare-grid">${products
          .filter((item) => ["backpack", "reebok"].includes(item.id))
          .map(
            (item) =>
              `<div><img src="assets/${item.image}" alt="${item.title}"><b>${item.title}</b><p>${money(item.price)}</p><p>${item.specs.Объём}</p><p>${item.specs.Состояние}</p><button class="secondary" data-action="product" data-id="${item.id}">Открыть</button></div>`,
          )
          .join("")}</div>`,
      );
      break;
    case "messages":
      html = sheet(
        "Сообщения",
        products
          .filter((item) => state.messages[item.id]?.length)
          .map(
            (item) =>
              `<button class="collection-row" data-action="open-chat" data-id="${item.id}"><b>${item.seller}</b><span>${escapeHtml(state.messages[item.id].at(-1))}</span></button>`,
          )
          .join("") ||
          "<p>Здесь появятся ваши переписки. Откройте товар и напишите продавцу.</p>",
      );
      break;
    case "menu":
      html = sheet(
        "Избранное",
        '<button class="option" data-action="map">Все товары на карте</button><button class="option" data-action="reset">Начать сценарий заново</button>',
      );
      break;
    case "profile":
      html = sheet(
        "Мой профиль",
        '<div class="seller-summary"><span class="avatar">М</span><div><b>Михаил</b><p>Санкт-Петербург</p></div></div><button class="option" data-action="favorites">Избранные товары</button><button class="option" data-action="cart">Корзина</button><button class="option" data-action="nav-messages">Сообщения</button>',
      );
      break;
    case "ads":
      html = sheet(
        "Мои объявления",
        '<h3>Пока нет объявлений</h3><p>Здесь будут товары, которые вы продаёте. А в избранном уже есть вещи, которые можно купить рядом.</p><button class="primary wide" data-action="favorites">Перейти в избранное</button>',
      );
      break;
  }
  const hadOverlay = Boolean(host.innerHTML);
  if (!hadOverlay && html) focusBeforeOverlay = document.activeElement;
  host.innerHTML = html;
  document.querySelector("#favorites").inert =
    Boolean(html) || state.view !== "favorites";
  document.querySelector("#map-controls").inert = Boolean(html);
  document.querySelector("#map-surface").inert = Boolean(html);
  if (html && state.overlay !== "address")
    requestAnimationFrame(() =>
      host
        .querySelector("button, input, [tabindex]")
        ?.focus({ preventScroll: true }),
    );
  else if (hadOverlay && focusBeforeOverlay?.isConnected)
    focusBeforeOverlay.focus({ preventScroll: true });
  if (state.overlay === "address") {
    document.querySelector("#address-input").focus({ preventScroll: true });
    document
      .querySelector("#address-input")
      .addEventListener("input", (event) => {
        document.querySelector("#address-results").innerHTML = addressResults(
          event.target.value,
        );
      });
    document
      .querySelector("#address-form")
      .addEventListener("submit", (event) => {
        event.preventDefault();
        const first = document.querySelector("#address-results [data-index]");
        if (first) chooseAddress(addresses[Number(first.dataset.index)]);
        else document.querySelector("#address-input").focus();
      });
  }
  if (state.overlay === "chat") {
    document
      .querySelector("#message-form")
      .addEventListener("submit", (event) => {
        event.preventDefault();
        const input = event.target.elements.message;
        const message = input.value.trim();
        if (!message) return;
        (state.messages[product.id] ||= []).push(message);
        renderOverlay();
        document.querySelector("#message-form input").focus();
        document
          .querySelector(".message.outgoing:last-child")
          ?.scrollIntoView({ block: "nearest" });
      });
  }
  if (state.overlay === "product") {
    const gallery = document.querySelector(".photo-gallery");
    gallery.addEventListener("scroll", () => {
      const total = (product.photos || [product.image]).length;
      document.querySelector(".photo-count").textContent =
        `${Math.min(total, Math.round(gallery.scrollLeft / (gallery.clientWidth * 0.66)) + 1)} из ${total}`;
    });
  }
}

function render() {
  document.querySelector("#favorites").hidden = state.view !== "favorites";
  document.querySelector("#map-screen").hidden = state.view !== "map";
  renderFavorites();
  renderMap();
  renderOverlay();
  app.dataset.screen = state.overlay || state.view;
}

function loadMap() {
  clearTimeout(loadingTimer);
  state.status = "loading";
  navigate({ view: "map", overlay: null });
  map.fit(state.radius);
  loadingTimer = setTimeout(() => {
    state.status = "ready";
    if (!navigator.onLine) state.overlay = "error";
    render();
  }, 550);
}

function chooseAddress(address) {
  state.origin = { ...address };
  state.located = true;
  state.picking = false;
  map.origin = state.origin;
  loadMap();
}

function openProduct(id) {
  if (!state.located) {
    state.located = true;
    map.origin = state.origin;
    map.fit(1000);
  }
  navigate({ view: "map", overlay: "product", selected: id, route: null });
}

function startRoute() {
  const product = selectedProduct();
  if (product.sold) return;
  navigate({ overlay: null, route: product.id });
  map.camera.x = (state.origin.x + product.x) / 2;
  map.camera.y = (state.origin.y + product.y) / 2 + 100;
  map.camera.scale = Math.min(
    1.1,
    (app.clientWidth - 90) /
      Math.max(200, Math.abs(product.x - state.origin.x)),
    (app.clientHeight - 430) /
      Math.max(200, Math.abs(product.y - state.origin.y)),
  );
  map.schedule();
}

const actions = {
  map: () =>
    state.located ? loadMap() : navigate({ view: "map", overlay: "geo" }),
  favorites: () =>
    navigate({ view: "favorites", overlay: null, picking: false, route: null }),
  close,
  "banner-close": () => {
    state.banner = false;
    renderFavorites();
  },
  category: (target) => {
    state.category = target.dataset.category;
    renderFavorites();
  },
  collection: (target) => {
    state.category = target.dataset.category;
    navigate({ view: "favorites", overlay: null });
  },
  product: (target) => openProduct(target.dataset.id),
  photo: (target) => {
    navigate({ overlay: "photo" });
    const gallery = document.querySelector(".full-photos");
    gallery.scrollLeft = Number(target.dataset.index) * gallery.clientWidth;
  },
  "back-product": () => navigate({ overlay: "product", route: null }, true),
  "other-products": () => {
    state.favorites = state.favorites.filter((id) => id !== state.selected);
    navigate({ overlay: null, selected: null });
  },
  favorite: (target) => {
    const id = target.dataset.id;
    if (state.favorites.includes(id))
      state.favorites = state.favorites.filter((value) => value !== id);
    else state.favorites.push(id);
    render();
    toast(
      state.favorites.includes(id)
        ? "Добавлено в избранное"
        : "Удалено из избранного",
    );
  },
  "cart-add": (target) => {
    const product = products.find((item) => item.id === target.dataset.id);
    if (product.sold) {
      openProduct(product.id);
      return;
    }
    if (!state.cart.includes(product.id)) state.cart.push(product.id);
    renderFavorites();
    toast("Товар в корзине");
  },
  "cart-remove": (target) => {
    state.cart = state.cart.filter((id) => id !== target.dataset.id);
    render();
  },
  "choose-sort": (target) => {
    state.sort = target.dataset.value;
    navigate({ overlay: null }, true);
  },
  radius: (target) => {
    state.radius = Number(target.dataset.radius);
    map.fit(state.radius);
    renderMap();
  },
  "zoom-in": () => map.zoom(1.5),
  "zoom-out": () => map.zoom(1 / 1.5),
  locate: () => {
    map.recenter();
    toast("Вы вернулись к выбранной точке");
  },
  "allow-location": () => chooseAddress(addresses[0]),
  "choose-address": (target) =>
    chooseAddress(addresses[Number(target.dataset.index)]),
  "pick-location": () => navigate({ overlay: null, picking: true }),
  "pick-center": () => pickAddress(map.world(map.width / 2, map.height / 2)),
  "retry-map": () => {
    state.located = true;
    loadMap();
  },
  nearest: () => {
    const nearest = [...favoriteProducts()].sort(
      (a, b) => distance(a, state.origin) - distance(b, state.origin),
    )[0];
    if (!nearest) {
      navigate({ view: "favorites" });
      return;
    }
    state.radius = distance(nearest, state.origin) <= 1000 ? 1000 : 5000;
    renderMap();
    map.fit(state.radius);
    map.camera.x = (nearest.x + state.origin.x) / 2;
    map.camera.y = (nearest.y + state.origin.y) / 2;
    map.schedule();
  },
  route: startRoute,
  "open-chat": (target) =>
    navigate({ selected: target.dataset.id, overlay: "chat" }),
  "reset-favorites": () => {
    state.favorites = products.map((product) => product.id);
    state.category = "Все";
    render();
  },
  reset: () => {
    location.href = location.href.split("?")[0].split("#")[0];
  },
  "nav-search": () => navigate({ overlay: "searches" }),
  "nav-ads": () => navigate({ overlay: "ads" }),
  "nav-messages": () => navigate({ overlay: "messages" }),
  "nav-profile": () => navigate({ overlay: "profile" }),
};
for (const name of [
  "address",
  "pickup",
  "delivery",
  "chat",
  "seller",
  "sort",
  "cart",
  "collections",
  "searches",
  "compare",
  "menu",
])
  actions[name] = () => navigate({ overlay: name });

function pickAddress(point) {
  const nearest = [...addresses].sort(
    (a, b) =>
      Math.hypot(a.x - point.x, a.y - point.y) -
      Math.hypot(b.x - point.x, b.y - point.y),
  )[0];
  chooseAddress({
    ...nearest,
    title: `${nearest.title} · точка на карте`,
    x: Math.round(point.x),
    y: Math.round(point.y),
  });
}

function initialize() {
  app.innerHTML = `<section id="favorites"></section><section id="map-screen" hidden><div id="map-surface"><canvas tabindex="0" aria-label="Карта товаров. Перемещайте стрелками, приближайте плюсом и минусом."></canvas><div class="markers"></div><div class="map-scale"></div></div><header class="map-header"><div class="status-bar"><img src="assets/16c6d.svg" alt="9:41"></div><button class="back-button" data-action="close" aria-label="Назад">${icon("back")}</button><button class="map-heading" data-action="address"><b>Избранные рядом</b><span><span id="address-title">Адрес не выбран</span>${icon("down")}</span></button></header><div id="map-controls"><div class="zoom-controls"><button data-action="zoom-in" aria-label="Приблизить карту">${icon("plus")}</button><button data-action="zoom-out" aria-label="Отдалить карту">${icon("minus")}</button></div><button class="locate-button" data-action="locate" aria-label="Вернуться к моей точке">${icon("locate")}</button><div id="radius-controls"></div></div><div id="map-hints"></div><div id="route-panel"></div></section><div id="overlay"></div><div class="home-indicator"></div><div id="toast" role="status" aria-live="polite"></div>`;
  map = new NeighborhoodMap(
    document.querySelector("#map-surface"),
    openProduct,
    pickAddress,
  );
  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (target && !target.disabled) actions[target.dataset.action]?.(target);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab" || !state.overlay) return;
    const focusable = [
      ...document
        .querySelector("#overlay")
        .querySelectorAll('button:not([disabled]), input, [tabindex="0"]'),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  window.addEventListener("popstate", (event) => {
    if (event.state) Object.assign(state, event.state);
    else
      Object.assign(state, {
        view: "favorites",
        overlay: null,
        route: null,
        picking: false,
      });
    render();
  });
  window.addEventListener("offline", () => {
    if (state.view === "map") {
      state.status = "error";
      navigate({ overlay: "error" });
    }
  });
  const scenario = new URLSearchParams(location.search).get("scenario");
  if (scenario) {
    Object.assign(state, { view: "map", located: true });
    if (scenario === "no-location")
      Object.assign(state, { overlay: "geo", located: false });
    if (scenario === "error") {
      state.overlay = "error";
      state.status = "error";
    }
    if (scenario === "empty") state.origin = { ...addresses[4] };
    if (scenario === "clusters") state.radius = 5000;
    if (scenario === "sold")
      Object.assign(state, { selected: "lamp-sold", overlay: "product" });
    if (scenario === "product")
      Object.assign(state, { selected: "lamp", overlay: "product" });
    if (scenario === "loading") {
      state.status = "loading";
      loadingTimer = setTimeout(() => {
        state.status = "ready";
        render();
      }, 2200);
    }
  }
  map.origin = state.origin;
  map.fit(state.radius);
  history.replaceState(routeState(), "", location.href);
  render();
}

const resourceImages = [
  ...new Set([
    ...products.flatMap((product) => product.photos || [product.image]),
    ...Object.values(icons),
    "16c6d.svg",
    "f5dec.png",
    "b75ec.png",
    "d3af9.svg",
    "57eef.svg",
    "f6e2e.png",
    "9426b.png",
    "1c423.svg",
  ]),
];
const warmedImages = [];

async function withTimeout(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Таймаут загрузки")), 18000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function preloadImage(path) {
  const image = new Image();
  image.src = `assets/${path}`;
  await withTimeout(image.decode());
  warmedImages.push(image);
}

async function preloadFont(descriptor) {
  const faces = await withTimeout(document.fonts.load(descriptor));
  if (!faces.length || faces.some((face) => face.status !== "loaded")) {
    throw new Error(`Не загружен шрифт ${descriptor}`);
  }
}

async function boot() {
  const loader = document.querySelector("#loader");
  const retry = document.querySelector("#retry-load");
  retry.hidden = true;
  loader.querySelector("p").textContent = "Загружаем избранное";
  try {
    await Promise.all([
      ...resourceImages.map(preloadImage),
      ...[400, 500, 700, 800].map((weight) =>
        preloadFont(`${weight} 16px "Avito Sans Text"`),
      ),
      preloadFont('700 32px "Avito Sans Display"'),
    ]);
    await document.fonts.ready;
    initialize();
    await new Promise(requestAnimationFrame);
    app.inert = false;
    app.setAttribute("aria-busy", "false");
    loader.hidden = true;
  } catch {
    loader.querySelector("p").textContent =
      "Не удалось загрузить прототип. Проверьте соединение и попробуйте ещё раз.";
    retry.hidden = false;
  }
}

document.querySelector("#retry-load").addEventListener("click", boot);
boot();
