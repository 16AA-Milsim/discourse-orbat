import Component from "@glimmer/component";

export default class OrbatBranch extends Component {
  get node() {
    return this.args.node || {};
  }

  get display() {
    return this.args.display || {};
  }

  get children() {
    return this.node.children || [];
  }

  get hasChildren() {
    return this.children.length > 0;
  }

  get hasMultipleChildren() {
    return this.children.length > 1;
  }
}
