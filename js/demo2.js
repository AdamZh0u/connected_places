// 工具函数
const utils = {
    format: d3.format(",.1f"),
    
    createRamp(color, n = 256) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext("2d");
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
    },

    // 错误处理工具
    handleError(error, message) {
        console.error(`${message}: `, error);
        throw new Error(`${message}: ${error.message}`);
    }
};

// 数据管理类
class DeathsDataManager {
    constructor() {
        this.deaths = null;
        this.statistics = null;
    }

    async initialize(deathsData) {
        try {
            const {data} = deathsData;
            this.deaths = new Map(Array.from(data, ({location_id, value}) => [location_id, value]));
            this.calculateStatistics();
            return this.deaths;
        } catch (error) {
            utils.handleError(error, "Failed to initialize deaths data");
        }
    }

    calculateStatistics() {
        const values = Array.from(this.deaths.values());
        this.statistics = {
            count: this.deaths.size,
            average: values.reduce((a, b) => a + b, 0) / this.deaths.size,
            max: Math.max(...values),
            min: Math.min(...values)
        };
    }

    getDeathRate(id) {
        return this.deaths.get(id);
    }

    getDifference(id1, id2) {
        const rate1 = this.deaths.get(id1);
        const rate2 = this.deaths.get(id2);
        return rate1 && rate2 ? rate1 - rate2 : null;
    }

    getGlobalData() {
        return {
            deaths: this.deaths,
            statistics: this.statistics,
            debug: {
                logDeathData: (id) => {
                    const data = this.deaths.get(id);
                    console.log(`Death data for ID ${id}:`, data);
                    return data;
                },
                getAllData: () => Array.from(this.deaths.entries()).slice(0, 10)
            }
        };
    }
}

// 添加全局变量和 getter
let globalDeathsManager = null;

function getGlobalDeaths() {
    if (!globalDeathsManager) {
        console.warn('Visualization not initialized yet');
        return null;
    }
    return globalDeathsManager.getGlobalData();
}

// 可视化管理类
class VisualizationManager {
    constructor() {
        this.svg = null;
        this.path = d3.geoPath();
        this.colorScale = null;
        this.deathsManager = new DeathsDataManager();
    }

    async initialize() {
        try {
            const [topology, deathsData, namesData] = await Promise.all([
                d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/topology.json"),
                d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/deaths.json"),
                d3.json("https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/names.json")
            ]);

            const deaths = await this.deathsManager.initialize(deathsData);
            const names = await this.processNames(namesData);
            
            this.setupVisualization(topology, deaths, names);
            return this.deathsManager;
        } catch (error) {
            utils.handleError(error, "Failed to initialize visualization");
        }
    }

    async processNames(namesData) {
        const {locations: {flat}} = namesData;
        const map = new Map(Array.from(flat, ({location_id, name}) => [location_id, name]));
        
        for (const {location_id, parent_id, level, name} of flat) {
            if (level === 2) {
                map.set(location_id, `${name}, ${map.get(parent_id)}`);
            }
        }
        
        return map;
    }

    setupVisualization(topology, deaths, names) {
        const states = topojson.mesh(topology.topology, topology.topology.objects.states, (a, b) => a !== b);
        const counties = topojson.feature(topology.topology, topology.topology.objects.counties).features;

        this.setupColorScale(deaths);
        this.createSvg();
        this.drawCounties(counties, deaths, names);
        this.drawStates(states);
        this.createLegend();
    }

    setupColorScale(deaths) {
        this.colorScale = d3.scaleSqrt()
            .domain([0, d3.max(Array.from(deaths.values()), d => d[1])])
            .interpolate(() => d3.interpolateBuPu);
    }

    createSvg() {
        this.svg = d3.select("#map")
            .append("svg")
            .attr("viewBox", "90 6 780 500")
            .style("overflow", "visible")
            .style("width", "100%")
            .style("height", "auto")
            .style("transform", "translate3d(0, 0, 0)");
    }

    drawCounties(counties, deaths, names) {
        this.svg.append("g")
            .selectAll("path")
            .data(counties)
            .enter()
            .append("path")
            .attr("d", this.path)
            .attr("fill", d => {
                const deathData = deaths.get(d.properties.location_id);
                return deathData ? this.colorScale(deathData[1]) : "#ccc";
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
                return `${names.get(d.properties.location_id)}\n${deathData ? utils.format(deathData[1]) : "No data"} deaths per 100,000 people`;
            });
    }

    drawStates(states) {
        this.svg.append("path")
            .datum(states)
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("d", this.path)
            .raise();
    }

    createLegend() {
        const legendContainer = d3.select("#map")
            .append("svg")
            .attr("width", 320)
            .attr("height", 45)
            .style("overflow", "visible")
            .style("position", "absolute")
            .style("bottom", "20px")
            .style("left", "20px");

        const legend = legendContainer.append("g")
            .attr("transform", "translate(0,20)")
            .call(d3.axisBottom(this.colorScale.copy().rangeRound(d3.quantize(d3.interpolate(0, 320), 10)))
                .tickSize(13)
                .ticks(5, utils.format))
            .call(g => g.selectAll(".tick line").attr("stroke", "#fff"))
            .call(g => g.select(".domain").remove());

        legend.insert("image", "*")
            .attr("width", 320)
            .attr("height", 13)
            .attr("preserveAspectRatio", "none")
            .attr("xlink:href", utils.createRamp(
                this.colorScale.interpolate(() => d3.interpolateBuPu),
                320  // 使宽度与legend容器相匹配
            ).toDataURL());

        legend.append("text")
            .attr("class", "caption")
            .attr("y", -6)
            .attr("fill", "#000")
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .text("Deaths per 100,000 people");
    }
}

// 初始化函数
async function initVisualization() {
    const visualizationManager = new VisualizationManager();
    globalDeathsManager = await visualizationManager.initialize();
    return globalDeathsManager;
}

// 导出
export { initVisualization, getGlobalDeaths };
