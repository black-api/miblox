// HeUi — scene graph (JavaScript side).
//
// The native core owns the authoritative scene graph on device builds. This
// mirror is used by the browser/Node hosts and by the editor, and it keeps the
// exact same semantics: local transforms compose down the tree, children are
// visited depth-first, and nodes can be looked up by name.

export class Node {
  constructor(name = 'node') {
    this.name = name;
    this.parent = null;
    this.children = [];
    this.position = { x: 0, y: 0 };
    this.rotation = 0;
    this.scale = { x: 1, y: 1 };
    this.visible = true;
    this.layer = 0;
    this.userData = {};
    this._world = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  createChild(name) {
    return this.addChild(new Node(name));
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  childByName(name) {
    return this.children.find((child) => child.name === name) || null;
  }

  get worldPosition() {
    return { x: this._world.x, y: this._world.y };
  }

  get worldRotation() {
    return this._world.rotation;
  }

  get worldScale() {
    return { x: this._world.scaleX, y: this._world.scaleY };
  }

  updateWorldTransform(parent) {
    this._world.x = parent.x + this.position.x * parent.scaleX;
    this._world.y = parent.y + this.position.y * parent.scaleY;
    this._world.rotation = parent.rotation + this.rotation;
    this._world.scaleX = parent.scaleX * this.scale.x;
    this._world.scaleY = parent.scaleY * this.scale.y;

    for (const child of this.children) {
      child.updateWorldTransform(this._world);
    }
  }

  forEachDepthFirst(fn) {
    fn(this);
    for (const child of this.children) child.forEachDepthFirst(fn);
  }
}

export class Scene {
  constructor(name = 'scene') {
    this.name = name;
    this.root = new Node('root');
    this.time = 0;
    this.entered = false;
  }

  onEnter() {
    this.entered = true;
    this.time = 0;
  }

  onExit() {
    this.entered = false;
  }

  update(dt) {
    this.time += dt;
    this.root.updateWorldTransform({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  }
}
