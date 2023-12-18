import { Routes } from '@angular/router';
import { ViewPage } from './pages/view/view.page';

export const routes: Routes = [
    {
        path: 'view/:entityKey',
        component: ViewPage
    }
];
