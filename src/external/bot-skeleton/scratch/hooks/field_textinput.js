/**
 * Install this text field on a block.
 */
window.Blockly.FieldTextInput.prototype.init = function () {
    if (this.fieldGroup_) {
        // Field has already been initialized once.
        return;
    }

    const notInShadow = !this.sourceBlock_.isShadow();

    if (notInShadow) {
        this.className_ += ' blocklyEditableLabel';
    }

    this.maxDisplayLength = 17;

    window.Blockly.FieldTextInput.superClass_.init.call(this);

    // If not in a shadow block, draw a box.
    if (notInShadow) {
        this.box_ = window.Blockly.utils.createSvgElement('rect', {
            rx: window.Blockly.BlockSvg.CORNER_RADIUS * 4,
            ry: window.Blockly.BlockSvg.CORNER_RADIUS * 4,
            x: 0,
            y: 0,
            width: this.size_.width,
            height: this.size_.height,
            fill: this.sourceBlock_.getColourSecondary(),
            stroke: this.sourceBlock_.getColourTertiary(),
            'stroke-width': '0.3px',
        });
        this.fieldGroup_.insertBefore(this.box_, this.textElement_);
    }
};
