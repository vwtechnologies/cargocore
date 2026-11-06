import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {Pagination,Modal} from '../../resources/js/components/ui';
afterEach(cleanup);
it('disables boundary navigation and moves to the next page',()=>{const change=vi.fn();render(<Pagination page={1} last={3} total={45} onChange={change}/>);expect(screen.getByRole('button',{name:'Previous page'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Next page'}));expect(change).toHaveBeenCalledWith(2)});
it('exposes an accessible dialog name and close action',()=>{const close=vi.fn();render(<Modal open title="Edit person" onClose={close}><input aria-label="Full name"/></Modal>);expect(screen.getByRole('dialog',{name:'Edit person'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(close).toHaveBeenCalled()});
