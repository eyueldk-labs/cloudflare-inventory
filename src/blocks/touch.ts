// Touch targets: 44px on small screens and on any coarse pointer. A wide
// screen with a fine pointer (mouse, trackpad) keeps the compact 32px controls.
// The data-size classes match SelectTrigger specificity. A plain h-11 loses to
// data-[size=default]:h-8.
export const touchHeight =
  "h-11 data-[size=default]:h-11 md:pointer-fine:h-8 md:pointer-fine:data-[size=default]:h-8"
// Shared by icon controls, including every dialog and sheet Close button.
export const touchSize = "size-11 md:pointer-fine:size-8"
