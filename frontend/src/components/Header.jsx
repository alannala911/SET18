import { Link } from "react-router-dom";
import { FiHeart, FiUser } from "react-icons/fi";
import logoIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Logo Østfold.png";
import searchIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/søker.png";
import shopIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/nettbutikk.png";

function Header({ count = 0, isAuthenticated = false }) {
  return (
    <header className="topbar">
            <Link className="brand" to="/">
              <img
                className="brand-logo"
                src={logoIcon}
                alt="Østfold Husflidslag"
              />
            </Link>

            <nav
              className="top-links"
              aria-label="Ekstra navigasjon"
            >
              <Link to="/sok">
                <img
                  className="top-icon"
                  src={searchIcon}
                  alt=""
                />
                Søk
              </Link>

              <Link to="/handlekurv">
                <img
                  className="top-icon"
                  src={shopIcon}
                  alt=""
                />
                {count > 0 && <span className="cart-count" aria-label={`${count} varer i handlekurven`}>{count}</span>}
                Handlekurv
              </Link>

              <Link to="/medlemskap">
                <FiHeart className="navigation-icon" aria-hidden="true" />
                Medlemskap
              </Link>

            <Link to="/min-side">
                <FiUser className="navigation-icon" aria-hidden="true" />
                {isAuthenticated ? "Min side" : "Logg inn"}
            </Link>
        </nav>
    </header>
  );
}
export default Header;