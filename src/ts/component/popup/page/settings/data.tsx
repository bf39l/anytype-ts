import * as React from 'react';
import { Title, Label, IconObject, ObjectName, Button } from 'Component';
import { analytics, C, UtilFile, I, translate, UtilCommon, UtilData, Renderer, Action } from 'Lib';
import { observer } from 'mobx-react';
import { commonStore, popupStore } from 'Store';

interface Props extends I.PopupSettings {
    onPage: (id: string) => void;
    setLoading: (v: boolean) => void;
};

const PopupSettingsPageDataManagement = observer(class PopupSettingsPageStorageIndex extends React.Component<Props, {}> {

    constructor (props: Props) {
        super(props);

        this.onOffload = this.onOffload.bind(this);
    };

    render () {
        const { onPage } = this.props;
		const { dataPath, spaceStorage } = commonStore
        const { localUsage } = spaceStorage;
		const suffix = this.getSuffix();

        return (
            <React.Fragment>
                <Title text={translate('popupSettingsDataManagementTitle')} />
                <Label className="description" text={translate(`popupSettingsDataManagementLocalStorageText${suffix}`)} />

                <div className="actionItems">
                    <div className="item storageUsage">
                        <div className="side left">
							<IconObject object={{ iconEmoji: ':desktop_computer:' }} size={44} />

							<div className="txt">
								<div className="name">{translate('popupSettingsDataLocalFiles')}</div>
								<div className="type">{UtilCommon.sprintf(translate(`popupSettingsDataManagementLocalStorageUsage`), UtilFile.size(localUsage))}</div>
							</div>
                        </div>
						<div className="side right">
							<Button color="blank" className="c28" text={translate(`popupSettingsDataManagementOffloadFiles${suffix}`)} onClick={this.onOffload} />
						</div>
                    </div>


					<div className="item">
						<div className="side left">
							<IconObject object={{ iconEmoji: ':file_folder:' }} size={44} />

							<div className="txt">
								<Title text={translate('popupSettingsDataManagementDataLocation')} />
								<Label text={dataPath} />
							</div>
						</div>
						<div className="side right">
							<Button color="blank" className="c28" text={translate(`commonOpen`)} onClick={this.onOpenDataLocation} />
							<Button color="blank" className="c28" text={translate(`commonChange`)} onClick={this.onChangeDataLocation.bind(this)} />
						</div>
					</div>
                </div>

                <Title className="sub" text={translate('popupSettingsDataManagementDeleteTitle')} />
                <Label className="description" text={translate('popupSettingsDataManagementDeleteText')} />
                <Button className="c36" onClick={() => onPage('delete')} color="red" text={translate('popupSettingsDataManagementDeleteButton')} />
            </React.Fragment>
        );
    };

    onOffload (e: any) {
        const { setLoading } = this.props;
		const suffix = this.getSuffix();
		const isLocalOnly = UtilData.isLocalOnly();

        analytics.event('ScreenFileOffloadWarning');

        popupStore.open('confirm',{
            data: {
                title: translate('commonAreYouSure'),
                text: translate(`popupSettingsDataOffloadWarningText${suffix}`),
                textConfirm: isLocalOnly ? translate('popupSettingsDataKeepFiles') : translate('commonYes'),
				canCancel: isLocalOnly,
				textCancel: translate('popupSettingsDataRemoveFiles'),
                onConfirm: () => {
                    setLoading(true);
                    analytics.event('SettingsStorageOffload');

                    C.FileListOffload([], false, (message: any) => {
                        setLoading(false);

                        if (message.error.code) {
                            return;
                        };

                        popupStore.open('confirm',{
                            data: {
                                title: translate('popupSettingsDataFilesOffloaded'),
                                //text: UtilCommon.sprintf('Files: %s, Size: %s', message.files, UtilFile.size(message.bytes)),
                                textConfirm: translate('commonOk'),
                                canCancel: false,
                            }
                        });

                        analytics.event('FileOffload', { middleTime: message.middleTime });
                    });
                },
            }
        });
    };

	onOpenDataLocation () {
		Renderer.send('pathOpen', commonStore.dataPath);
	};

	onConfirmStorage (onConfirm: () => void) {
		popupStore.open('confirm', {
			data: {
				title: translate('commonAreYouSure'),
				text: translate('popupSettingsOnboardingLocalOnlyWarningText'),
				textConfirm: translate('popupSettingsOnboardingLocalOnlyWarningConfirm'),
				onConfirm,
			},
		});
	};
    
    onChangeDataLocation () {
        // console.log("change");
        // console.log(commonStore);
        // console.log(commonStore.config.mode);
        // console.log(this);
        // Renderer.send('pathChange', commonStore.dataPath);
        const onConfirm = () => {
            const cb = (paths: string[]) => {
                // console.log(paths);
                Renderer.send('setUserDataPath', paths[0]);
                // commonStore.dataPathSet(paths[0]+"/data");
                // this.onChange("userPath", paths[0]);
                // this.onChange('userPath', UtilCommon.getElectron().defaultPath());
                // Renderer.send('appOnLoad');
                Renderer.send('exit', "", true);
            }
			Action.openDir({}, cb);
		};
        // this.onConfirmStorage(onConfirm);
		if (commonStore.config.mode == I.NetworkMode.Local) {
			this.onConfirmStorage(onConfirm);
		} else {
			onConfirm();
		};
    };

	getSuffix () {
		return UtilData.isLocalOnly() ? 'LocalOnly' : '';
	};

});

export default PopupSettingsPageDataManagement;
