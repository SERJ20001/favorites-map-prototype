const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const noise = (x, y) =>
  Math.abs(Math.sin(x * 13.13 + y * 71.7) * 43758.5453) % 1;

export class NeighborhoodMap {
  constructor(element, onSelect, onPick) {
    this.element = element;
    this.canvas = element.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    this.markers = element.querySelector(".markers");
    this.onSelect = onSelect;
    this.onPick = onPick;
    this.camera = { x: 0, y: -180, scale: 0.82 };
    this.origin = { x: 0, y: 0 };
    this.items = [];
    this.pointers = new Map();
    this.frame = 0;
    this.route = null;
    this.pick = false;
    this.moved = false;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);
    this.canvas.addEventListener("pointerdown", (event) => this.start(event));
    this.canvas.addEventListener("pointermove", (event) => this.move(event));
    this.canvas.addEventListener("pointerup", (event) => this.end(event));
    this.canvas.addEventListener("pointercancel", (event) => this.end(event));
    this.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.zoom(
          Math.exp(-event.deltaY * 0.002),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      },
      { passive: false },
    );
    this.canvas.addEventListener("dblclick", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.zoom(1.7, event.clientX - rect.left, event.clientY - rect.top);
    });
    this.canvas.addEventListener("keydown", (event) => {
      const directions = {
        ArrowLeft: [-70, 0],
        ArrowRight: [70, 0],
        ArrowUp: [0, -70],
        ArrowDown: [0, 70],
      };
      if (directions[event.key]) {
        event.preventDefault();
        this.camera.x += directions[event.key][0] / this.camera.scale;
        this.camera.y += directions[event.key][1] / this.camera.scale;
        this.schedule();
      } else if (event.key === "+" || event.key === "=") this.zoom(1.5);
      else if (event.key === "-") this.zoom(1 / 1.5);
    });
  }

  resize() {
    this.width = this.element.clientWidth;
    this.height = this.element.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.schedule();
  }

  point(x, y) {
    return {
      x: (x - this.camera.x) * this.camera.scale + this.width / 2,
      y: (y - this.camera.y) * this.camera.scale + this.height / 2,
    };
  }

  world(x, y) {
    return {
      x: (x - this.width / 2) / this.camera.scale + this.camera.x,
      y: (y - this.height / 2) / this.camera.scale + this.camera.y,
    };
  }

  setItems(items, origin, selected = null) {
    this.items = items;
    this.origin = origin;
    this.selected = selected;
    this.schedule();
  }

  fit(radius, origin = this.origin) {
    this.camera.scale = radius === 500 ? 0.82 : radius === 1000 ? 0.37 : 0.095;
    this.camera.x = origin.x;
    this.camera.y = origin.y - 180 / this.camera.scale;
    this.schedule();
  }

  recenter() {
    this.camera.x = this.origin.x;
    this.camera.y = this.origin.y - 160 / this.camera.scale;
    this.schedule();
  }

  zoom(factor, x = this.width / 2, y = this.height / 2) {
    const anchor = this.world(x, y);
    this.camera.scale = clamp(this.camera.scale * factor, 0.055, 2.8);
    this.camera.x = anchor.x - (x - this.width / 2) / this.camera.scale;
    this.camera.y = anchor.y - (y - this.height / 2) / this.camera.scale;
    this.schedule();
  }

  start(event) {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.moved = false;
    this.startPoint = { x: event.clientX, y: event.clientY };
    this.canvas.classList.add("dragging");
    this.resetGesture();
  }

  resetGesture() {
    const points = [...this.pointers.values()];
    this.gesture = { camera: { ...this.camera }, points };
  }

  move(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (
      Math.hypot(
        event.clientX - this.startPoint.x,
        event.clientY - this.startPoint.y,
      ) > 5
    )
      this.moved = true;
    const points = [...this.pointers.values()];
    const initial = this.gesture;
    if (points.length === 1) {
      this.camera.x =
        initial.camera.x -
        (points[0].x - initial.points[0].x) / initial.camera.scale;
      this.camera.y =
        initial.camera.y -
        (points[0].y - initial.points[0].y) / initial.camera.scale;
    } else {
      const span = (pair) =>
        Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const rect = this.canvas.getBoundingClientRect();
      const startMid = {
        x: (initial.points[0].x + initial.points[1].x) / 2 - rect.left,
        y: (initial.points[0].y + initial.points[1].y) / 2 - rect.top,
      };
      const endMid = {
        x: (points[0].x + points[1].x) / 2 - rect.left,
        y: (points[0].y + points[1].y) / 2 - rect.top,
      };
      const scale = clamp(
        (initial.camera.scale * span(points)) /
          Math.max(1, span(initial.points)),
        0.055,
        2.8,
      );
      this.camera.x =
        initial.camera.x +
        (startMid.x - this.width / 2) / initial.camera.scale -
        (endMid.x - this.width / 2) / scale;
      this.camera.y =
        initial.camera.y +
        (startMid.y - this.height / 2) / initial.camera.scale -
        (endMid.y - this.height / 2) / scale;
      this.camera.scale = scale;
      this.moved = true;
    }
    this.camera.x = clamp(this.camera.x, -7000, 7000);
    this.camera.y = clamp(this.camera.y, -7000, 7000);
    this.schedule();
  }

  end(event) {
    this.pointers.delete(event.pointerId);
    if (!this.pointers.size) {
      this.canvas.classList.remove("dragging");
      if (this.pick && !this.moved) {
        const rect = this.canvas.getBoundingClientRect();
        this.onPick(
          this.world(event.clientX - rect.left, event.clientY - rect.top),
        );
      }
    } else this.resetGesture();
  }

  schedule() {
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.draw();
      });
  }

  draw() {
    if (!this.width || !this.height) return;
    const ctx = this.context;
    const s = this.camera.scale;
    const first = this.world(0, 0);
    const last = this.world(this.width, this.height);
    ctx.fillStyle = "#f1f0e9";
    ctx.fillRect(0, 0, this.width, this.height);
    const block = 180;
    const startX = Math.floor(first.x / block) - 1;
    const endX = Math.ceil(last.x / block) + 1;
    const startY = Math.floor(first.y / block) - 1;
    const endY = Math.ceil(last.y / block) + 1;
    for (let col = startX; col <= endX; col++) {
      for (let row = startY; row <= endY; row++) {
        const p = this.point(col * block, row * block);
        const park = noise(col + 31, row + 51) > 0.83;
        const size = (block - 21) * s;
        ctx.fillStyle = park ? "#d5e8c5" : "#e9e7df";
        ctx.beginPath();
        ctx.roundRect(p.x + 11 * s, p.y + 11 * s, size, size, 6 * s);
        ctx.fill();
        if (park) {
          ctx.strokeStyle = "#e9f2dd";
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          ctx.moveTo(p.x + 20 * s, p.y + 30 * s);
          ctx.lineTo(p.x + 150 * s, p.y + 150 * s);
          ctx.stroke();
          if (s > 0.35)
            this.label("Сквер", p.x + size / 2, p.y + size / 2, "#739372", 10);
        } else if (s > 0.14) {
          for (let bx = 0; bx < 3; bx++)
            for (let by = 0; by < 3; by++) {
              if (bx === 1 && by === 1) continue;
              const width = (31 + noise(col + bx, row + by) * 9) * s;
              ctx.fillStyle = "#ddd9cf";
              ctx.strokeStyle = "#cec9bd";
              ctx.lineWidth = 0.6;
              const x = p.x + (23 + bx * 46) * s;
              const y = p.y + (23 + by * 46) * s;
              ctx.beginPath();
              ctx.roundRect(x, y, width, 31 * s, 2 * s);
              ctx.fill();
              ctx.stroke();
              if (s > 0.65)
                this.label(
                  String((Math.abs(col * 2 + row * 3 + bx * 2 + by) % 68) + 2),
                  x + width / 2,
                  y + 18 * s,
                  "#a5a195",
                  8,
                );
            }
        }
      }
    }
    for (let col = startX; col <= endX; col++)
      this.road(
        [
          { x: col * block, y: first.y - 200 },
          { x: col * block, y: last.y + 200 },
        ],
        col % 4 === 0 ? 22 : 13,
        col % 4 === 0 ? "#fff2d2" : "#fff",
      );
    for (let row = startY; row <= endY; row++)
      this.road(
        [
          { x: first.x - 200, y: row * block },
          { x: last.x + 200, y: row * block },
        ],
        row % 4 === 0 ? 22 : 13,
        row % 4 === 0 ? "#fff2d2" : "#fff",
      );
    const river = [];
    for (let y = first.y - 400; y <= last.y + 400; y += 120)
      river.push({ x: -1050 + Math.sin(y / 650) * 190, y });
    this.line(river, "#b9dbe6", 125 * s);
    for (let row = startY; row <= endY; row++)
      if (row % 4 === 0)
        this.road(
          [
            { x: -1400, y: row * block },
            { x: -700, y: row * block },
          ],
          22,
          "#fff2d2",
        );
    if (s > 0.28) {
      const streetNames = [
        "Чкаловский проспект",
        "Большая Зеленина улица",
        "улица Ленина",
        "Большой проспект П.С.",
        "Пионерская улица",
      ];
      for (let row = startY; row <= endY; row += 2) {
        const p = this.point(this.camera.x, row * block);
        this.label(
          streetNames[((row % 5) + 5) % 5],
          this.width * (row % 4 === 0 ? 0.45 : 0.6),
          p.y + 4,
          "#888781",
          10,
        );
      }
      const metro = this.point(35, 70);
      this.label("М  Чкаловская", metro.x, metro.y, "#a2659c", 11);
    } else {
      for (const area of [
        { x: 0, y: -600, title: "ПЕТРОГРАДСКАЯ СТОРОНА" },
        { x: -2200, y: 1200, title: "КРЕСТОВСКИЙ ОСТРОВ" },
        { x: 2100, y: 1800, title: "ЦЕНТРАЛЬНЫЙ РАЙОН" },
      ]) {
        const p = this.point(area.x, area.y);
        this.label(area.title, p.x, p.y, "#aaa89f", 10);
      }
    }
    if (this.route) {
      const route = [
        this.origin,
        { x: this.origin.x, y: Math.round(this.origin.y / block) * block },
        {
          x: Math.round(this.route.x / block) * block,
          y: Math.round(this.origin.y / block) * block,
        },
        { x: Math.round(this.route.x / block) * block, y: this.route.y },
        this.route,
      ];
      this.line(route, "#ffffff", 9);
      this.line(route, "#00aaff", 5);
    }
    this.renderMarkers();
    const scaleMeters = s > 1 ? 50 : s > 0.4 ? 100 : s > 0.15 ? 250 : 1000;
    const scaleEl = this.element.querySelector(".map-scale");
    scaleEl.style.width = `${scaleMeters * s}px`;
    scaleEl.textContent = scaleMeters === 1000 ? "1 км" : `${scaleMeters} м`;
    this.element.dataset.zoom = String(Math.round(s * 1000) / 1000);
  }

  label(text, x, y, color, size) {
    this.context.font = `500 ${size}px "Avito Sans Text"`;
    this.context.textAlign = "center";
    this.context.fillStyle = color;
    this.context.fillText(text, x, y);
  }

  line(points, color, width) {
    const ctx = this.context;
    ctx.beginPath();
    points.forEach((point, index) => {
      const p = this.point(point.x, point.y);
      if (index) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  road(points, width, fill) {
    this.line(points, "#dad7ce", width * this.camera.scale + 1.5);
    this.line(points, fill, width * this.camera.scale);
  }

  renderMarkers() {
    const groups = [];
    for (const item of this.items) {
      const p = this.point(item.x, item.y);
      if (
        p.x < -100 ||
        p.x > this.width + 100 ||
        p.y < 70 ||
        p.y > this.height + 70
      )
        continue;
      const group =
        this.camera.scale < 0.3 &&
        groups.find(
          (candidate) => Math.hypot(candidate.x - p.x, candidate.y - p.y) < 58,
        );
      if (group) {
        group.items.push(item);
        group.x =
          group.items.reduce(
            (sum, entry) => sum + this.point(entry.x, entry.y).x,
            0,
          ) / group.items.length;
        group.y =
          group.items.reduce(
            (sum, entry) => sum + this.point(entry.x, entry.y).y,
            0,
          ) / group.items.length;
      } else groups.push({ x: p.x, y: p.y, items: [item] });
    }
    const fragment = document.createDocumentFragment();
    for (const group of groups) {
      const button = document.createElement("button");
      button.style.left = `${group.x}px`;
      button.style.top = `${group.y}px`;
      if (group.items.length > 1) {
        button.className = "map-cluster";
        button.textContent = group.items.length;
        button.setAttribute(
          "aria-label",
          `Приблизить группу из ${group.items.length} товаров`,
        );
        button.addEventListener("click", () => {
          this.camera.x =
            group.items.reduce((sum, item) => sum + item.x, 0) /
            group.items.length;
          this.camera.y =
            group.items.reduce((sum, item) => sum + item.y, 0) /
            group.items.length;
          this.zoom(2.5);
        });
      } else {
        const item = group.items[0];
        const detailed = this.camera.scale > 0.3;
        button.className = `map-pin ${detailed ? "detailed" : ""} ${this.selected === item.id ? "selected" : ""}`;
        button.dataset.product = item.id;
        button.setAttribute(
          "aria-label",
          `${item.title}, ${item.price} рублей`,
        );
        const image = document.createElement("img");
        image.src = `assets/${item.image}`;
        image.alt = "";
        button.append(image);
        if (detailed) {
          const text = document.createElement("span");
          const price = document.createElement("b");
          price.textContent = `${new Intl.NumberFormat("ru-RU").format(item.price)} ₽`;
          const title = document.createElement("span");
          title.textContent = item.short;
          text.append(price, title);
          button.append(text);
        }
        button.addEventListener("click", () => this.onSelect(item.id));
      }
      fragment.append(button);
    }
    if (this.origin.visible !== false) {
      const origin = this.point(this.origin.x, this.origin.y);
      const location = document.createElement("div");
      location.className = "origin-pin";
      location.setAttribute("aria-label", "Точка отсчёта расстояния");
      location.style.left = `${origin.x}px`;
      location.style.top = `${origin.y}px`;
      fragment.append(location);
    }
    this.markers.replaceChildren(fragment);
  }
}
