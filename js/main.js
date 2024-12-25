// 设置尺寸和边距
const margin = { top: 20, right: 20, bottom: 30, left: 40 };
const width = 960 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;


// 创建颜色比例尺†
const colors = chroma.scale([
    "#fff", "#ece7f2", "#d0d1e6", "#a6bddb", 
    "#74a9cf", "#3690c0", "#0570b0", "#045a8d", "#023858"
]).mode("hcl").colors(11);

const colorScale = d3.scaleThreshold()
    .domain([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    .range(colors.reverse());

// 创建SVG
const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

// 创建地图投影
const projection = d3.geoMercator()
    .center([0, 0])
    .scale(150)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// 加载地图数据
Promise.all([
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'),
    d3.json('data/sample.json')
]).then(([worldData, connectionsData]) => {
    // 绘制地图基础层
    svg.append('g')
        .selectAll('path')
        .data(worldData.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', '#ccc')
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5);

    // 创建图例
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 120}, 20)`);

    const legendRects = legend.selectAll('rect')
        .data(colorScale.domain())
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d, i) => i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .style('fill', d => colorScale(d));

    legend.selectAll('text')
        .data(colorScale.domain())
        .enter()
        .append('text')
        .attr('x', 20)
        .attr('y', (d, i) => i * 20 + 12)
        .text(d => `${(d * 100).toFixed(0)}%`);
});