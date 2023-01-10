import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react';
import $ from 'jquery';
import * as d3 from 'd3';
import { I, Util, DataUtil, SmileUtil, FileUtil, translate, Relation } from 'Lib';
import { commonStore, blockStore } from 'Store';

interface Props {
	isPopup?: boolean;
	rootId: string;
	data: any;
	onClick?: (object: any) => void;
	onContextMenu?: (id: string, param: any) => void;
	onSelect?: (id: string) => void;
};

const FONT = 'Helvetica';

const Graph = observer(class Graph extends React.Component<Props, object> {

	node: any = null;
	canvas: any = null;
	simulation: any = null;
	width: number = 0;
	height: number = 0;
	edges: any[] = [];
	nodes: any[] = [];
	zoom: any = null;
	worker: any = null;
	images: any = {};
	subject: any = null;
	isDragging: boolean = false;
	ids: string[] = [];

	forceProps: any = {
		center: {
			x: 0.5,
			y: 0.5
		},
		charge: {
			enabled: true,
			strength: -30,
			distanceMin: 20,
			distanceMax: 200
		},
		collide: {
			enabled: true,
			strength: 0.3,
			iterations: 1,
			radius: 0.5
		},
		link: {
			enabled: true,
			strength: 0.3,
			distance: 50,
			iterations: 1,
		},
		forceX: {
			enabled: true,
			strength: 0.3,
			x: 0.4,
		},
		forceY: {
			enabled: true,
			strength: 0.3,
			y: 0.4,
		},

		orphans: true,
		markers: true,
		labels: true,
		relations: true,
		links: true,
		filter: '',
	};

	constructor (props: any) {
		super(props);

		this.onMessage = this.onMessage.bind(this);
		this.nodeMapper = this.nodeMapper.bind(this);
	};

	render () {
		const { isPopup } = this.props;

		return (
			<div ref={node => this.node = node} id="graphWrapper">
				<div id={'graph' + (isPopup ? '-popup' : '')} />
			</div>
		);
	};

	componentWillUnmount () {
		if (this.worker) {
			this.worker.terminate();
		};

		$('body').removeClass('cp');
	};

	init () {
		const { data, isPopup } = this.props;
		const node = $(this.node);
		const density = window.devicePixelRatio;
		const elementId = '#graph' + (isPopup ? '-popup' : '');
		const transform: any = {};
		
		this.width = node.width();
		this.height = node.height();
		this.zoom = d3.zoom().scaleExtent([ 1, 6 ]).on('zoom', e => this.onZoom(e));

		const scale = transform.k || 5;
		const w = this.width;
		const h = this.height;
		const x = transform.x || -w * 2;
		const y = transform.y || -h * 2;

		this.edges = (data.edges || []).map(this.edgeMapper);
		this.nodes = (data.nodes || []).map(this.nodeMapper);

		this.canvas = d3.select(elementId).append('canvas')
		.attr('width', (this.width * density) + 'px')
		.attr('height', (this.height * density) + 'px')
		.node();

		const transfer = node.find('canvas').get(0).transferControlToOffscreen();

		this.worker = new Worker('workers/graph.js');
		this.worker.onerror = (e: any) => { console.log(e); };
		this.worker.addEventListener('message', (data) => { this.onMessage(data); });

		this.send('init', { 
			canvas: transfer, 
			width: this.width,
			height: this.height,
			density,
			nodes: this.nodes,
			edges: this.edges,
			forceProps: this.forceProps,
			theme: commonStore.getThemeClass(),
		}, [ transfer ]);

		d3.select(this.canvas)
        .call(d3.drag().
			subject(() => { return this.subject; }).
			on('start', (e: any, d: any) => this.onDragStart(e, d)).
			on('drag', (e: any, d: any) => this.onDragMove(e, d)).
			on('end', (e: any, d: any) => this.onDragEnd(e, d))
		)
        .call(this.zoom)
		.call(this.zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale))
		.on('click', (e: any) => {
			const [ x, y ] = d3.pointer(e);
			this.send(e.shiftKey ? 'onSelect' : 'onClick', { x, y });
		})
		.on('contextmenu', (e: any) => {
			const [ x, y ] = d3.pointer(e);
			this.send('onContextMenu', { x, y });
		})
		.on('mousemove', (e: any) => {
			const [ x, y ] = d3.pointer(e);
			this.send('onMouseMove', { x, y });
		});
	};

	nodeMapper (d: any) {
		const { rootId } = this.props;
		const sourceCnt = this.edges.filter(it => it.source == d.id).length;
		const targetCnt = this.edges.filter(it => it.target == d.id).length;

		d.layout = Number(d.layout) || 0;
		d.radius = Math.max(3, Math.min(8, sourceCnt + targetCnt));
		d.isRoot = d.id == rootId;
		d.isOrphan = !targetCnt && !sourceCnt;
		d.src = this.imageSrc(d);
		d.sourceCnt = sourceCnt;
		d.targetCnt = targetCnt;

		if (d.layout == I.ObjectLayout.Note) {
			d.name = d.snippet || translate('commonEmpty');
		} else {
			d.name = d.name || DataUtil.defaultName('page');
		};

		d.name = SmileUtil.strip(d.name);
		d.shortName = Util.shorten(d.name, 16);
		d.letter = d.name.trim().substr(0, 1).toUpperCase();
		d.font = `${d.radius}px ${FONT}`;

		// Clear icon props to fix image size
		if (d.layout == I.ObjectLayout.Task) {
			d.iconImage = '';
			d.iconEmoji = '';
		};

		if (!this.images[d.src]) {
			const img = new Image();

			img.onload = () => {
				if (this.images[d.src]) {
					return;
				};

				createImageBitmap(img, { resizeWidth: 160, resizeQuality: 'high' }).then((res: any) => {
					if (this.images[d.src]) {
						return;
					};

					this.images[d.src] = true;
					this.send('image', { src: d.src, bitmap: res });
				});
			};
			img.crossOrigin = '';
			img.src = d.src;
		};

		return d;
	};

	edgeMapper (d: any) {
		d.type = Number(d.type) || 0;
		d.typeName = translate('edgeType' + d.type);
		return d;
	};

	updateProps () {
		this.send('updateProps', { forceProps: this.forceProps } );
	};

	onDragStart (e: any, d: any) {
		this.isDragging = true;
		this.send('onDragStart', { active: e.active });

		$('body').addClass('grab');
	};

	onDragMove (e: any, d: any) {
		const p = d3.pointer(e, d3.select(this.canvas));
		const node = $(this.node);
		const offset = node.offset();
		const id = this.subject.id;
		const x = p[0] - offset.left;
		const y = p[1] - offset.top;

		this.send('onDragMove', { 
			subjectId: id, 
			active: e.active, 
			x: x, 
			y: y,
		});
	};
			
	onDragEnd (e: any, d: any) {
		this.isDragging = false;
		this.subject = null;
		this.send('onDragEnd', { active: e.active });

		$('body').removeClass('grab');
	};

	onZoom ({ transform }) {
		this.send('onZoom', { transform: transform });
  	};

	onMessage ({ data }) {
		const { root } = blockStore;
		const { isPopup, onClick, onContextMenu, onSelect } = this.props;
		const body = $('body');

		switch (data.id) {
			case 'onClick':
				if (data.node.id != root) {
					onClick(data.node);
				};
				break;

			case 'onSelect':
				if (data.node.id != root) {
					onSelect(data.node.id);
				};
				break;

			case 'onMouseMove':
				if (!this.isDragging) {
					this.subject = this.nodes.find(d => d.id == data.node);
					this.subject ? body.addClass('cp') : body.removeClass('cp');
				};
				break;

			case 'onContextMenu':
				if (data.node == root) {
					break;
				};

				onContextMenu(data.node, {
					recalcRect: () => { 
						const rect = { width: 0, height: 0, x: data.x, y: data.y };

						if (isPopup) {
							const container = Util.getPageContainer(isPopup);
							const { left, top } = container.offset();

							rect.x += left;
							rect.y += top;
						};

						return rect;
					},
				});
				break;

		};
	};

	imageSrc (d: any) {
		let src = '';

		if (d.id == blockStore.root) {
			return 'img/icon/home-big.svg';
		};

		switch (d.layout) {
			case I.ObjectLayout.Relation:
				src = `img/icon/relation/big/${Relation.typeName(d.relationFormat)}.svg`;
				break;

			case I.ObjectLayout.Task:
				src = `img/icon/checkbox${Number(d.done) || 0}.svg`;
				break;

			case I.ObjectLayout.File:
				src = `img/icon/file/${FileUtil.icon(d)}.svg`;
				break;

			case I.ObjectLayout.Image:
				if (d.id) {
					src = commonStore.imageUrl(d.id, 160);
				} else {
					src = `img/icon/file/${FileUtil.icon(d)}.svg`;
				};
				break;
				
			case I.ObjectLayout.Human:
				src = d.iconImage ? commonStore.imageUrl(d.iconImage, 160) : '';
				break;

			case I.ObjectLayout.Note:
				src = 'img/icon/note.svg';
				break;

			case I.ObjectLayout.Bookmark:
				src = commonStore.imageUrl(d.iconImage, 24);
				break;
				
			default:
				if (d.iconImage) {
					src = commonStore.imageUrl(d.iconImage, 160);
				} else
				if (d.iconEmoji) {
					const data = SmileUtil.data(d.iconEmoji);
					if (data) {
						src = SmileUtil.srcFromColons(data.colons, data.skin);
					};
					src = src.replace(/^.\//, '');
				};
		
				if (!src) {
					src = 'img/icon/page.svg';
				};		
				break;
		};

		return src;
	};

	send (id: string, param: any, transfer?: any[]) {
		if (this.worker) {
			this.worker.postMessage({ id: id, ...param }, transfer);
		};
	};

	resize () {
		const node = $(this.node);
		const density = window.devicePixelRatio;

		this.width = node.width();
		this.height = node.height();

		this.send('onResize', { width: this.width, height: this.height, density: density });
	};

});

export default Graph;