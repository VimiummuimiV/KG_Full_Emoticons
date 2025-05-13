const iconSize = "22";
const svgUrl = "http://www.w3.org/2000/svg";
const viewbox = "0 0 24 24";

export const clearSVG = `
  <svg xmlns="${svgUrl}"
    width="${iconSize}"
    height="${iconSize}"
    viewBox="${viewbox}"
    stroke="currentColor"
    fill="none"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`;

export const closeSVG = `
  <svg xmlns="${svgUrl}"
    width="${iconSize}"
    height="${iconSize}"
    viewBox="${viewbox}"
    stroke="currentColor" 
    fill="none"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="9" x2="15" y2="15"></line>
      <line x1="15" y1="9" x2="9" y2="15"></line>
  </svg>`;