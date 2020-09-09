import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { RouteComponentProps } from 'react-router';
import { HeaderMainHistory as Header, Block, Loader, Icon } from 'ts/component';
import { blockStore } from 'ts/store';
import { I, M, C, Util, dispatcher, Storage } from 'ts/lib';
import { observer } from 'mobx-react';

interface Props extends RouteComponentProps<any> { };

interface State {
	versions: I.Version[];
};

const $ = require('jquery');

@observer
class PageMainHistory extends React.Component<Props, State> {

	state = {
		versions: [] as I.Version[],
	};
	
	version: I.Version = null;
	refHeader: any = null;
	scrollLeft: number = 0;
	scrollRight: number = 0;

	constructor (props: any) {
		super(props);
	};

	render () {
		const { match } = this.props;
		const versions = this.groupData(this.state.versions);
		const rootId = match.params.id;

		const root = blockStore.getLeaf(rootId, rootId);
		if (!this.version || !root) {
			return <Loader />;
		};

		const childrenIds = blockStore.getChildrenIds(rootId, rootId);
		const children = blockStore.getChildren(rootId, rootId);
		const details = blockStore.getDetails(rootId, rootId);
		const length = childrenIds.length;

		const withIcon = details.iconEmoji || details.iconImage;
		const withCover = (details.coverType != I.CoverType.None) && details.coverId;
		const cover = new M.Block({ id: rootId + '-cover', type: I.BlockType.Cover, childrenIds: [], fields: {}, content: {} });
		
		let cn = [ 'editorWrapper' ];
		let icon: any = { id: rootId + '-icon', childrenIds: [], fields: {}, content: {} };
		
		if (root && root.isPageProfile()) {
			cn.push('isProfile');
			icon.type = I.BlockType.IconUser;
		} else {
			icon.type = I.BlockType.IconPage;
		};

		if (root && root.isPageSet()) {
			cn.push('isDataview');
		};
		
		icon = new M.Block(icon);
		
		if (withIcon && withCover) {
			cn.push('withIconAndCover');
		} else
		if (withIcon) {
			cn.push('withIcon');
		} else
		if (withCover) {
			cn.push('withCover');
		};
		
		const Section = (item: any) => (
			<React.Fragment>
				<div className="section">
					<div className="date">{item.groupId}</div>
				</div>
				
				<div className="items">
					{item.list.map((item: any, i: number) => {
						return <Version key={i} {...item} />
					})}
				</div>
			</React.Fragment>
		);

		const Version = (item: any) => {
			const withChildren = item.list && item.list.length;
			return (
				<React.Fragment>
					<div id={'item-' + item.id} className={[ 'item', (withChildren ? 'withChildren' : '') ].join(' ')} onClick={(e: any) => { this.loadVersion(item.id); }}>
						{withChildren ? <Icon className="arrow" onClick={(e: any) => { this.toggleChildren(e, item.id); }} /> : ''}
						<div className="date">{Util.date('d F Y, H:i:s', item.time)}</div>
						{item.authorName ? <div className="name">{item.authorName}</div> : ''}
					</div>

					{withChildren ? (
						<div id={'children-' + item.id} className="children">
							{item.list.map((child: any, i: number) => {
								return <Version key={i} {...child} />
							})}
						</div>
					) : ''}
				</React.Fragment>
			);
		};
		
		return (
			<div>
				<Header ref={(ref: any) => { this.refHeader = ref; }} {...this.props} rootId={rootId} version={this.version} />
				<div id="body" className="flex">
					<div id="sideLeft" className="wrapper">
						<div className={cn.join(' ')}>
							{withCover ? <Block {...this.props} rootId={rootId} key={cover.id} block={cover} readOnly={true} /> : ''}
							<div className="editor">
								<div className="blocks">
									{withIcon ? (
										<Block 
											key={icon.id} 
											{...this.props} 
											rootId={rootId}
											block={icon} 
											className="root" 
											readOnly={true}
										/>	
									) : ''}
									
									{children.map((block: I.Block, i: number) => {
										return (
											<Block 
												key={block.id} 
												{...this.props}
												rootId={rootId}
												index={i}
												block={block}
												onKeyDown={() => {}}
												onKeyUp={() => {}} 
												onMenuAdd={() => {}}
												onPaste={() => {}}
												readOnly={true}
											/>
										)
									})}
								</div>

								<div className="blockLast" />
							</div>
						</div>
					</div>

					<div id="sideRight" className="list">
						{versions.map((item: any, i: number) => {
							return <Section key={i} {...item} />
						})}
					</div>
				</div>
			</div>
		);
	};
	
	componentDidMount () {
		this.loadList();
		this.resize();
		this.setId();
	};

	componentDidUpdate () {
		const node = $(ReactDOM.findDOMNode(this));
		const sideLeft = node.find('#sideLeft');
		const sideRight = node.find('#sideRight');
		const self = this;

		this.resize();
		this.setId();
		
		if (this.version) {
			this.show(this.version.id);
		};

		sideLeft.scrollTop(this.scrollLeft);
		sideRight.scrollTop(this.scrollRight);

		sideLeft.unbind('scroll').scroll(function () { console.log(self.scrollLeft); self.scrollLeft = $(this).scrollTop(); });
		sideRight.unbind('scroll').scroll(function () { console.log(self.scrollRight); self.scrollRight = $(this).scrollTop(); });
	};

	setId () {
		const { match } = this.props;
		Storage.set('pageId', match.params.id);
	};

	show (id: string) {
		if (!id) {
			return;
		};

		const { versions } = this.state;
		const data = this.groupData(versions);
		const version = versions.find((it: any) => { return it.id == id; });
		if (!version) {
			return;
		};

		const month = data.find((it: any) => { return it.groupId == this.monthId(version.time); });
		if (!month) {
			return;
		};

		let group = month.list.find((it: any) => { return it.groupId == version.groupId; });
		if (!group) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		const sideRight = node.find('#sideRight');
		const item = sideRight.find('#item-' + version.id);

		sideRight.find('.active').removeClass('active');
		item.addClass('active');

		if (group) {
			const groupItem = sideRight.find('#item-' + group.id);
			const children = sideRight.find('#children-' + group.id);

			groupItem.addClass('expanded');
			children.show();
		};
	};

	toggleChildren (e: any, id: string) {
		e.stopPropagation();

		const node = $(ReactDOM.findDOMNode(this));
		const sideRight = node.find('#sideRight');
		const item = sideRight.find('#item-' + id);
		const children = sideRight.find('#children-' + id);
		const isActive = item.hasClass('expanded');

		let height = 0;
		if (isActive) {
			item.removeClass('expanded');
			children.css({ overflow: 'visible', height: 'auto' });
			height = children.height();
			children.css({ overflow: 'hidden', height: height });

			setTimeout(() => { children.css({ height: 0 }); }, 15);
			setTimeout(() => { children.hide(); }, 215);
		} else {
			item.addClass('expanded');
			children.show();
			children.css({ overflow: 'visible', height: 'auto' });
			height = children.height();

			children.css({ overflow: 'hidden', height: 0 });
			setTimeout(() => { children.css({ height: height }); }, 15);
			setTimeout(() => { children.css({ overflow: 'visible', height: 'auto' }); }, 215);
		};
	};
	
	loadList () { 
		const { match } = this.props;
		const rootId = match.params.id;

		C.HistoryVersions(rootId, '', 100, (message: any) => {
			if (message.error.code || !message.versions.length) {
				return;
			};

			this.setState({ versions: message.versions });

			if (!this.version) {
				this.loadVersion(message.versions[0].id);
			};
		});
  	};
  
	loadVersion (id: string) {
		const { match } = this.props;
		const rootId = match.params.id;

		C.HistoryShow(rootId, id, (message: any) => {
			if (message.error.code) {
				return;
			};

			this.version = message.version;

			let bs = message.blockShow;
			dispatcher.onBlockShow(rootId, bs.type, bs.blocks, bs.details);
			
			this.forceUpdate();
		});
	};
	
	groupData (versions: any[]) {
		let months: any[] = [];
    	let groups: any[] = [];

		for (let version of versions) {
			let group = groups.find((it: any) => { return it.groupId == version.groupId; });
			if (!group) {
				group = { ...version, groupId: version.groupId, list: [] };
				groups.push(group);
      		} else {
				group.list.push(version);
			};
		};

		for (let group of groups) {
			let groupId = this.monthId(group.time);
			let month = months.find((it: any) => { return it.groupId == groupId; });
      
			if (!month) {
				month = { groupId: groupId, list: [] };
				months.push(month);
      		};

      		month.list.push(group);
		};

		return months;
	};

	monthId (time: number) {
		return Util.date('F Y', time);
	};

	resize () {
		const win = $(window);
		const node = $(ReactDOM.findDOMNode(this));
		const sideLeft = node.find('#sideLeft');
		const sideRight = node.find('#sideRight');
		const height = win.height();

		sideLeft.css({ height: height });
		sideRight.css({ height: height });
	};

};

export default PageMainHistory;