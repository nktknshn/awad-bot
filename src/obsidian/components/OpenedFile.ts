import { pipe } from "fp-ts/lib/pipeable";
import { connected } from "Lib/component";
import { button } from "Lib/elements-constructors";
import { action, caseText, ifTrue, on } from "Lib/input";
import { A, inputHandler, message } from 'Lib/lib';
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import path from "path";
import { getOpenFile, getStoreActions, getOpenFileContent } from '../selectors';
import { boldify, brailleSymbol } from "../util";
import { InputBox } from './InputBox';

export const OpenedFile = connected(
    select(getStoreActions),
    function* ({ storeActions }, { openFileContent, openFile }: {
        openFileContent?: string, openFile?: string
    },
        { getState, set }: GetSetState<{
            rename: boolean;
            autoNl: boolean;
            doAddSpace: boolean;
            addSymbol: string;
            newFileName?: string;
            mode: 'list' | 'replace' | 'append';
        }>) {

        if (!openFile)
            return;

        if (openFileContent === undefined)
            return;

        const detectMode = openFileContent ? () => {
            const lines = openFileContent.split('\n').filter(_ => _.length)
            return lines[lines.length - 1].startsWith('-') ? 'list' : 'append'
        } : (): 'append' => 'append'

        const { rename, newFileName, addSymbol, mode } = getState({
            autoNl: true,
            doAddSpace: false,
            addSymbol: '\n',
            rename: false,
            mode: detectMode()
        });

        const setAddSymbol = set('addSymbol');
        const setRename = set('rename');
        const setNewFileName = set('newFileName');
        const setMode = set('mode');

        const resetRename = [setRename(false), setNewFileName(undefined)];

        const firstLine = (text: string) => pipe(
            text.split('\n'),
            lines => lines.length > 0 ? lines[0] : undefined
        )

        const mapMessageText = (messageText: string) =>
            pipe(messageText
                , text => mode === 'list'
                    ? '- ' + text
                    : text
                , text => openFileContent[openFileContent.length - 1] != '\n' ? '\n' + text : text
            )

        const addNil = (messageText: string) => messageText + addSymbol;

        const onTextAction = (messageText: string) =>
            (firstLine(messageText) == firstLine(openFileContent) ||
                mode === 'replace')
                ? [setMode('append'), storeActions.setContent(
                    pipe(
                        messageText,
                        text => text[text.length - 2] == '\n'
                            && text[text.length - 1] == '>'
                            ? text.slice(0, text.length - 1)
                            : text
                    ))]
                : storeActions.appendLine(
                    pipe(messageText,
                        mapMessageText,
                        addNil
                    ));

        yield inputHandler([
            on(caseText,
                ifTrue(_ => openFileContent !== undefined),
                ifTrue(c => !c.messageText.startsWith('/')),
                action(({ messageText }) => onTextAction(messageText)))
        ]);

        const formatContent = (content: string) => pipe(
            content.split('\n'),
            A.map(line => boldify(_ => line.startsWith('#'), line)),
            A.map(line => line.replace(/\[\[(.+)\]\]/, '<code>[[$1]]</code>')),
            list => list.join('\n'),
            text => text.length && text[text.length - 1] == '\n'
                ? text + `<code>></code>`
                : text
        );

        if (openFile)
            yield button('Close file', () => [
                storeActions.setOpenFile(undefined)
            ]);

        yield button(`Rename`,
            () => setRename(true));

        if (mode === 'replace') {
            yield button('Replace', () => setMode('append'));
        }
        if (mode === 'list') {
            yield button(`\\n`,
                () => storeActions.appendLine('\n'));
            yield button('List', () => setMode('replace'));

        }
        if (mode === 'append') {
            yield button(`\\n`,
                () => storeActions.appendLine('\n'));
            yield button(`(${addSymbol.charCodeAt(0)})`,
                () => addSymbol == '\n' ?
                    setAddSymbol(' ')
                    : addSymbol == ' ' ? setAddSymbol('') : setAddSymbol('\n'));
            yield button('Append', () => setMode('list'));
        }

        yield message(openFileContent.length ? formatContent(openFileContent) : '<code>empty</code>');

        if (rename && !newFileName) {
            yield InputBox({
                title: `Rename ${path.basename(openFile).replace('.md', '')} to ...`,
                cancelTitle: 'Cancel',
                onCancel: () => resetRename,
                onSuccess: name => [setNewFileName(name.replace('..', ''))],
                onWrongInput: () => []
            });
            return;
        }
        else if (rename && newFileName) {
            yield message(`Rename ${path.basename(openFile).replace('.md', '')} to ${newFileName}?`);
            yield button('Yes', () => [
                resetRename,
                storeActions.renameFile(openFile, newFileName),
            ]);
            yield button('No', () => resetRename);
            return;
        }

    });
