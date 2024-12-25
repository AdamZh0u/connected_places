// 在文件开头添加格式化器
const format = d3.format(",.1f");

// 添加全局变量存储deaths数据
let globalDeaths;

// 在文件开头添加
window.getGlobalDeaths = function() {
    return globalDeaths;
};

// 在文件开头添加 ramp 函数
function ramp(color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext("2d");
    canvas.width = 1;
    canvas.height = 100;
    
    for (let i = 0; i < 100; ++i) {
        context.fillStyle = color(i / 99);
        context.fillRect(0, 99 - i, 1, 1);
    }
    
    return canvas;
}

async function initVisualization() {
    // 获取地形数据
    const topology = (await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/topology.json")).topology;

    // 创建地图特征
    const states = topojson.mesh(topology, topology.objects.states, (a, b) => a !== b);
    const counties = topojson.feature(topology, topology.objects.counties).features;

    // 获取死亡率数据
    const deaths = await (async () => {
        const {data} = await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/deaths.json");
        const deathsMap = new Map(Array.from(data, ({location_id, value}) => [location_id, value]));
        return deathsMap;
    })();

    // 添加颜色比例尺
    const colorScale = d3.scaleSqrt()
        .domain([0, d3.max(Array.from(deaths.values()), d => d[1])])
        .interpolate(() => d3.interpolateBuPu);

    // 设置全局变量
    globalDeaths = {
        raw: await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/deaths.json"),
        map: deaths,
        entries: Array.from(deaths.entries()),
        values: Array.from(deaths.values()),
        keys: Array.from(deaths.keys()),
        statistics: {
            count: deaths.size,
            average: Array.from(deaths.values()).reduce((a, b) => a + b, 0) / deaths.size,
            max: Math.max(...deaths.values()),
            min: Math.min(...deaths.values())
        },
        getDeathRate: (id) => deaths.get(id),
        getDifference: (id1, id2) => {
            const rate1 = deaths.get(id1);
            const rate2 = deaths.get(id2);
            return rate1 && rate2 ? rate1 - rate2 : null;
        },
        debug: {
            logDeathData: (id) => {
                const data = deaths.get(id);
                console.log(`Death data for ID ${id}:`, data);
                return data;
            },
            getAllData: () => Array.from(deaths.entries()).slice(0, 10)
        }
    };

    // 获取地名数据
    const names = await (async () => {
        const {locations: {flat}} = await d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/names.json");
        const map = new Map(Array.from(flat, ({location_id, name}) => [location_id, name]));
        for (const {location_id, parent_id, level, name} of flat) {
            if (level === 2) {
                map.set(location_id, `${name}, ${map.get(parent_id)}`);
            }
        }
        return map;
    })();

    // 设置地图投影
    const path = d3.geoPath();

    // 创建SVG
    const svg = d3.select("#map")
        .append("svg")
        .attr("viewBox", "90 6 780 500")
        .style("overflow", "visible")
        .style("width", "100%")
        .style("height", "auto")
        .style("transform", "translate3d(0, 0, 0)");

    // 在绘制县界之前添加调试日志
    console.log("Counties data sample:", counties.slice(0, 3));

    // 绘制县界
    svg.append("g")
        .selectAll("path")
        .data(counties)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => {
            const deathData = deaths.get(d.properties.location_id);
            return deathData ? colorScale(deathData[1]) : "#ccc";
        })
        .on("mouseover", function() { 
            d3.select(this)
                .attr("stroke", "#000")
                .raise(); 
        })
        .on("mouseout", function() { 
            d3.select(this)
                .attr("stroke", null)
                .lower(); 
        })
        .append("title")
        .text(d => {
            const deathData = deaths.get(d.properties.location_id);
            return `${names.get(d.properties.location_id)}\n${deathData ? format(deathData[1]) : "No data"} deaths per 100,000 people`;
        });

    // 绘制州界
    svg.append("path")
        .datum(states)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("d", path)
        .raise();

    // 创建图例容器
    const legendContainer = d3.select("#map")
        .append("svg")
        .attr("width", 320)
        .attr("height", 45)
        .style("overflow", "visible")
        .style("position", "absolute")
        .style("bottom", "20px")
        .style("left", "20px");

    // 创建图例
    const legend = legendContainer.append("g")
        .attr("transform", "translate(0,20)")
        .call(d3.axisBottom(colorScale.copy().rangeRound(d3.quantize(d3.interpolate(0, 320), 10)))
            .tickSize(13)
            .ticks(5, format))
        .call(g => g.selectAll(".tick line").attr("stroke", "#fff"))
        .call(g => g.select(".domain").remove());

    // 添加渐变背景
    legend.insert("image", "*")
        .attr("width", 320)
        .attr("height", 13)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", ramp(colorScale.interpolate(() => d3.interpolateBuPu)).toDataURL());

    // 添加标题
    legend.append("text")
        .attr("class", "caption")
        .attr("y", -6)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("Deaths per 100,000 people");

    // 返回全局变量以便在初始化完成后访问
    return globalDeaths;
}

// 导出函数和全局变量的 getter
export { 
    initVisualization,
    getGlobalDeaths
};

// 添加 getter 函数的定义
function getGlobalDeaths() {
    return globalDeaths;
}