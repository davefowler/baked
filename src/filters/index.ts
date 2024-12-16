
import { Filter, FilterMap } from '../types';
export const filters: FilterMap = {};



export const registerFilter = (name: string, filter: Filter): void => {
    filters[name] = filter;
}