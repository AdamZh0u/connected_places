// 声明全局变量
let path;
let names;

// 添加 ramp 函数
function ramp(color, n = 256) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = n;
    canvas.height = 1;

    const x = d3.scaleLinear()
        .domain(d3.quantize(d3.interpolate(0, n - 1), color.domain().length))
        .range(color.domain());

    for (let i = 0; i < n; ++i) {
        context.fillStyle = color(x(i));
        context.fillRect(i, 0, 1, 1);
    }
    return canvas;
}

// 添加图例函数
function legend(color) {
    const width = 240;
    const height = 40;
    const marginTop = 16;
    const marginRight = 0;
    const marginBottom = 14;
    const marginLeft = 0;
    const ticks = width / 64;

    const svg = d3.select("#legend")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "visible")
        .style("display", "block");

    let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);

    const x = d3.scaleLinear()
        .domain(color.domain())
        .range([marginLeft, width - marginRight]);

    svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", ramp(color).toDataURL());

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(ticks)
            .tickFormat(d => d.toFixed(1)))
        .call(tickAdjust)
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", marginLeft)
            .attr("y", marginTop + marginBottom - height - 6)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .text("Deaths per 100,000 people"));
}

async function getNames() {
    const { locations: { flat } } = await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/names.json");
    const map = new Map(Array.from(flat, ({ location_id, name }) => [location_id, name]));
    for (const { location_id, parent_id, level, name }
        of flat) {
        if (level === 2) {
            map.set(location_id, `${name}, ${map.get(parent_id)}`);
        }
    }
    return map;
}

function createVisualization(states, counties, unit_data) {
    const width = 960;
    const height = 600;

    // 创建用于显示提示的函数
    const getTitle = (id) => {
        const data = unit_data.get(id);
        return `${names.get(id)}
${data ? data[0].toFixed(1) : 'N/A'} deaths per 100,000 people`;
    };

    // 创建SVG
    const svg = d3.select("#map")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    path = d3.geoPath();

    // 创建颜色比例尺
    const color = d3.scaleSqrt()
        .interpolate(() => d3.interpolateBuPu)
        .domain([0, d3.max([...unit_data.values()], d => Math.max(...d))]);

    // 添加图例
    legend(color);

    // 绘制counties
    svg.selectAll("path")
        .data(counties)
        .enter()
        .append("path")
        .attr("fill", d => {
            const data = unit_data.get(d.properties.location_id);
            return data ? color(data[1]) : "#ccc";
        })
        .attr("d", path)
        .on("mouseover", function(d) {
            // 高亮显示当前路径
            d3.select(this)
                .attr("stroke", "#000")
                .attr("stroke-width", 1.5)
                .raise();

            // 更新信息框，使用 HTML 格式化
            const locationId = d.properties.location_id;
            const data = unit_data.get(locationId);

            d3.select("#location-info")
                .html(`<div class="info-id">ID: ${locationId}</div>
<div class="info-name">${names.get(locationId)}</div>
<div class="info-data">Deaths: ${data ? data[0].toFixed(1) : 'N/A'} per 100,000</div>`);
        })
        .on("mouseout", function() {
            // 恢复路径样式
            d3.select(this)
                .attr("stroke", null)
                .lower();

            // 重置信息框，保持三行布局
            d3.select("#location-info")
                .html(`<div class="info-id">&nbsp;</div>
<div class="info-name">Hover over a region</div>
<div class="info-data">to see details</div>`);
        })
        .append("title")
        .text(d => getTitle(d.properties.location_id));

    // 绘制state边界
    svg.append("path")
        .datum(states)
        .attr("fill", "none")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("d", path);
}

async function init() {
    // 加载数据
    const topology = (await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/topology.json")).topology;
    const states = topojson.mesh;
    (topology, topology.objects.states, (a, b) => a !== b)
    const counties = topojson.feature(topology, topology.objects.counties).features;

    const { data } = await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/deaths.json");
    const unit_data = new Map(Array.from(data, ({ location_id, value }) => [location_id, value]));

    names = await getNames();

    // 初始化信息框
    d3.select("#location-info")
        .html(`<div class="info-id">&nbsp;</div>
<div class="info-name">Hover over a region</div>
<div class="info-data">to see details</div>`);

    // 创建可视化
    createVisualization(states, counties, unit_data);
}

// 启动应用
init();