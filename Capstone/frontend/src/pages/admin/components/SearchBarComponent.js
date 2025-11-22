import React from 'react';
import '../styles/searchStyle.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const SearchBar = ({ placeholder, onSearch }) => {
    return (
        <div className="search-bar">
            <i className="bi bi-search search-icon"></i>
            <input
                type="text"
                placeholder={placeholder}
                onChange={(e) => onSearch(e.target.value)}
            />
        </div>
    );
};

export default SearchBar;
