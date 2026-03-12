<?php
use Joomla\CMS\Extension\PluginInterface;
use Joomla\CMS\Plugin\PluginHelper;
use Joomla\CMS\Factory;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;
use Joomla\Event\DispatcherInterface;
use SuperSoft\Plugin\EditorsXtd\SiteHiddenButton\Extension\SiteHiddenButton;

defined('_JEXEC') or die;

return new class implements ServiceProviderInterface {
    public function register(Container $container)
    {
        $container->set(PluginInterface::class, function (Container $c) {
            $dispatcher = $c->get(DispatcherInterface::class);
            $plugin     = new SiteHiddenButton(
                $dispatcher,
                (array) PluginHelper::getPlugin('editors-xtd', 'sitehiddenbutton')
            );
            $plugin->setApplication(Factory::getApplication());
            return $plugin;
        });
    }
};